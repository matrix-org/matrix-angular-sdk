/*
Copyright 2014 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

/*
This service wraps up Matrix API calls. 

This serves to isolate the caller from changes to the underlying url paths, as
well as attach common params (e.g. access_token) to requests.
*/
angular.module('matrixService', [])
.factory('matrixService', ['$http', '$timeout', '$q', function($http, $timeout, $q) {
        
   /* 
    * Permanent storage of user information
    * The config contains:
    *    - homeserver url
    *    - Identity server url
    *    - user_id
    *    - access_token
    *    - version: the version of this cache
    */    
    var config;
    
    // Current version of permanent storage
    var configVersion = 0;
    var prefixPath = "/_matrix/client/api/v1";
    var handleRateLimiting = true;
    var rateLimitMaxMs = 1000 * 20; // 20s
    
    var DEFAULT_TYPING_TIMEOUT_MS = 20000;

    var doRequest = function(method, path, params, data, $httpParams) {
        if (!config) {
            // try to load it
            loadConfig();
            if (!config) {
                console.error("No config exists. Cannot perform request to "+path);
                var defer = $q.defer();
                defer.reject("No config");
                return defer.promise;
            }
        }
    
        // Inject the access token
        if (!params) {
            params = {};
        }
        
        params.access_token = config.access_token;
        
        if (path.indexOf(prefixPath) !== 0) {
            path = prefixPath + path;
        }
        
        return doBaseRequest(config.homeserver, method, path, params, data, undefined, $httpParams);
    };

    var doBaseRequest = function(baseUrl, method, path, params, data, headers, $httpParams) {

        var request = {
            method: method,
            url: baseUrl + path,
            params: params,
            data: data,
            headers: headers
        };

        // Add additional $http parameters
        if ($httpParams) {
            angular.extend(request, $httpParams);
        }
        
        if (handleRateLimiting) {
            // wrap the request in another deferred so we can do rate limit 
            // handling if we need to.
            var defer = $q.defer();
            
            $http(request).then(function(response) {
                defer.resolve(response); // pass through
            },
            function(error) {
                // check for rate limiting.
                if (error.data && error.data.errcode === "M_LIMIT_EXCEEDED" &&
                        error.data.retry_after_ms !== undefined) {
                    handleRateLimit(defer, request, error, 0);
                }
                else {
                    // either not a rate limit or not enough info to wait, so 
                    // ignore it and pass through.
                    defer.reject(error);
                }
            });
            return defer.promise;
        }
        else {
            return $http(request);
        }
    };
    
    // recursively called to handle rate limiting: giving up based on the cumulative
    // time spent waiting.
    var handleRateLimit = function(defer, request, error, timeWaiting) {
        // base case
        if (timeWaiting > rateLimitMaxMs) {
            console.error("Giving up rate limited request: spent too long retrying.");
            defer.reject(error);
            return;
        }
        var retryAfterMs = error.data.retry_after_ms;
        console.log("Rate limited. Waiting "+retryAfterMs+"ms. Already waited "+
                    timeWaiting+"ms.");
        $timeout(function() {
            console.log("Waited "+retryAfterMs+"ms, retrying request.");
            $http(request).then(function(response) {
                defer.resolve(response);
            },
            function(err) {
                timeWaiting += retryAfterMs;
                handleRateLimit(defer, request, err, timeWaiting);
            });
        }, retryAfterMs);
    };
    
    var doRegisterLogin = function(path, loginType, sessionId, userName, password, threepidCreds) {
        var data = {};
        if (loginType === "m.login.recaptcha") {
            var challengeToken = Recaptcha.get_challenge();
            var captchaEntry = Recaptcha.get_response();
            data = {
                type: "m.login.recaptcha",
                challenge: challengeToken,
                response: captchaEntry
            };
        }
        else if (loginType === "m.login.email.identity") {
            data = {
                threepidCreds: threepidCreds
            };
        }
        else if (loginType === "m.login.password") {
            data = {
                user: userName,
                password: password
            };
        }
        
        if (sessionId) {
            data.session = sessionId;
        }
        data.type = loginType;
        console.log("doRegisterLogin >>> " + loginType);
        return doRequest("POST", path, undefined, data);
    };
    
    var loadConfig = function() {
        if (!config) {
            config = localStorage.getItem("config");
            if (config) {
                config = JSON.parse(config);

                // Reset the cache if the version loaded is not the expected one
                if (configVersion !== config.version) {
                    config = undefined;
                    saveConfig();
                }
            }
        }
        return config;
    };
    
    var storeConfig = function() {
        config.version = configVersion;
        localStorage.setItem("config", JSON.stringify(config));
    };

    return {
        DEFAULT_TYPING_TIMEOUT_MS: DEFAULT_TYPING_TIMEOUT_MS,
        prefix: prefixPath,
        
        shouldHandleRateLimiting: function(handleLimiting) {
            handleRateLimiting = handleLimiting;
        },
        
        giveUpRateLimitRetryAfter: function(ms) {
            rateLimitMaxMs = ms;
        },

        // Register an user
        register: function(user_name, password, threepidCreds, useCaptcha) {
            // registration is composed of multiple requests, to check you can
            // register, then to actually register. This deferred will fire when
            // all the requests are done, along with the final response.
            var deferred = $q.defer();
            var path = "/register";
            
            // check we can actually register with this HS.
            doRequest("GET", path, undefined, undefined).then(
                function(response) {
                    console.log("/register [1] : "+JSON.stringify(response));
                    var flows = response.data.flows;
                    var knownTypes = [
                        "m.login.password",
                        "m.login.recaptcha",
                        "m.login.email.identity"
                    ];
                    // if they entered 3pid creds, we want to use a flow which uses it.
                    var useThreePidFlow = threepidCreds != undefined;
                    var flowIndex = 0;
                    var firstRegType = undefined;
                    
                    for (var i=0; i<flows.length; i++) {
                        var isThreePidFlow = false;
                        if (flows[i].stages) {
                            for (var j=0; j<flows[i].stages.length; j++) {
                                var regType = flows[i].stages[j];
                                if (knownTypes.indexOf(regType) === -1) {
                                    deferred.reject("Unknown type: "+regType);
                                    return;
                                }
                                if (regType == "m.login.email.identity") {
                                    isThreePidFlow = true;
                                }
                                if (!useCaptcha && regType == "m.login.recaptcha") {
                                    console.error("Web client setup to not use captcha, but HS demands a captcha.");
                                    deferred.reject({
                                        data: {
                                            errcode: "M_CAPTCHA_NEEDED",
                                            error: "Home server requires a captcha."
                                        }
                                    });
                                    return;
                                }
                            }
                        }
                        
                        if ( (isThreePidFlow && useThreePidFlow) || (!isThreePidFlow && !useThreePidFlow) ) {
                            flowIndex = i;
                        }
                        
                        if (knownTypes.indexOf(flows[i].type) == -1) {
                            deferred.reject("Unknown type: "+flows[i].type);
                            return;
                        }
                    }
                    
                    // looks like we can register fine, go ahead and do it.
                    console.log("Using flow " + JSON.stringify(flows[flowIndex]));
                    firstRegType = flows[flowIndex].type;
                    var sessionId = undefined;
                    
                    // generic response processor so it can loop as many times as required
                    var loginResponseFunc = function(response) {
                        if (response.data.session) {
                            sessionId = response.data.session;
                        }
                        console.log("login response: " + JSON.stringify(response.data));
                        if (response.data.access_token) {
                            deferred.resolve(response);
                        }
                        else if (response.data.next) {
                            var nextType = response.data.next;
                            if (response.data.next instanceof Array) {
                                for (var i=0; i<response.data.next.length; i++) {
                                    if (useThreePidFlow && response.data.next[i] == "m.login.email.identity") {
                                        nextType = response.data.next[i];
                                        break;
                                    }
                                    else if (!useThreePidFlow && response.data.next[i] != "m.login.email.identity") {
                                        nextType = response.data.next[i];
                                        break;
                                    }
                                }
                            }
                            return doRegisterLogin(path, nextType, sessionId, user_name, password, threepidCreds).then(
                                loginResponseFunc,
                                function(err) {
                                    deferred.reject(err);
                                }
                            );
                        }
                        else {
                            deferred.reject("Unknown continuation: "+JSON.stringify(response));
                        }
                    };
                    
                    // set the ball rolling
                    doRegisterLogin(path, firstRegType, undefined, user_name, password, threepidCreds).then(
                        loginResponseFunc,
                        function(err) {
                            deferred.reject(err);
                        }
                    );
                    
                },
                function(err) {
                    deferred.reject(err);
                }
            );
            
            return deferred.promise;
        },

        // Create a room
        create: function(room_alias, visibility, inviteList) {
            // The REST path spec
            var path = "/createRoom";

            var req = {
                "visibility": visibility
            };
            if (room_alias) {
                req.room_alias_name = room_alias;
            }
            if (inviteList) {
                req.invite = inviteList;
            }
            
            return doRequest("POST", path, undefined, req);
        },

        // Get the user's current state: his presence, the list of his rooms with
        // the last {limit} events
        initialSync: function(limit, feedback) {
            // The REST path spec

            var path = "/initialSync";

            var params = {};
            if (limit) {
                params.limit = limit;
            }
            if (feedback) {
                params.feedback = feedback;
            }

            return doRequest("GET", path, params);
        },
        
        // get room state for a specific room
        roomState: function(room_id) {
            var path = "/rooms/" + encodeURIComponent(room_id) + "/state";
            return doRequest("GET", path);
        },
        
        // get room initialSync for a specific room
        roomInitialSync: function(room_id, limit) {
            var path = "/rooms/" + encodeURIComponent(room_id) + "/initialSync";
            if (!limit) {
                limit = 30;
            }
            return doRequest("GET", path, { limit: limit });
        },

        join: function(room_alias_or_id) {
            var path = "/join/$room_alias_or_id";
            room_alias_or_id = encodeURIComponent(room_alias_or_id);

            path = path.replace("$room_alias_or_id", room_alias_or_id);

            // TODO: PUT with txn ID
            return doRequest("POST", path, undefined, {});
        },
        
        // Invite a user to a room
        invite: function(room_id, user_id) {
            return this.membershipChange(room_id, user_id, "invite");
        },

        // Leaves a room
        leave: function(room_id) {
            return this.membershipChange(room_id, undefined, "leave");
        },

        membershipChange: function(room_id, user_id, membershipValue) {
            // The REST path spec
            var path = "/rooms/$room_id/$membership";
            path = path.replace("$room_id", encodeURIComponent(room_id));
            path = path.replace("$membership", encodeURIComponent(membershipValue));

            var data = {};
            if (user_id !== undefined) {
                data = { user_id: user_id };
            }

            // TODO: Use PUT with transaction IDs
            return doRequest("POST", path, undefined, data);
        },

        // Change the membership of an another user
        setMembership: function(room_id, user_id, membershipValue, reason) {
            
            // The REST path spec
            var path = "/rooms/$room_id/state/m.room.member/$user_id";
            path = path.replace("$room_id", encodeURIComponent(room_id));
            path = path.replace("$user_id", user_id);

            return doRequest("PUT", path, undefined, {
                membership : membershipValue,
                reason: reason
            });
        },
           
        // Bans a user from a room
        ban: function(room_id, user_id, reason) {
            var path = "/rooms/$room_id/ban";
            path = path.replace("$room_id", encodeURIComponent(room_id));
            
            return doRequest("POST", path, undefined, {
                user_id: user_id,
                reason: reason
            });
        },
        
        // Unbans a user in a room
        unban: function(room_id, user_id) {
            // FIXME: To update when there will be homeserver API for unban 
            // For now, do an unban by resetting the user membership to "leave"
            return this.setMembership(room_id, user_id, "leave");
        },
        
        // Kicks a user from a room
        kick: function(room_id, user_id, reason) {
            // Set the user membership to "leave" to kick him
            return this.setMembership(room_id, user_id, "leave", reason);
        },
        
        // Retrieves the room ID corresponding to a room alias
        resolveRoomAlias:function(room_alias) {
            var path = "/_matrix/client/api/v1/directory/room/$room_alias";
            room_alias = encodeURIComponent(room_alias);

            path = path.replace("$room_alias", room_alias);

            return doRequest("GET", path, undefined, {});
        },
        
        setName: function(room_id, name) {
            var data = {
                name: name
            };
            return this.sendStateEvent(room_id, "m.room.name", data);
        },
        
        setTopic: function(room_id, topic) {
            var data = {
                topic: topic
            };
            return this.sendStateEvent(room_id, "m.room.topic", data);
        },
        
        
        sendStateEvent: function(room_id, eventType, content, state_key) {
            var path = "/rooms/$room_id/state/"+ encodeURIComponent(eventType);
            if (state_key !== undefined) {
                path += "/" + encodeURIComponent(state_key);
            }
            room_id = encodeURIComponent(room_id);
            path = path.replace("$room_id", room_id);

            return doRequest("PUT", path, undefined, content);
        },

        sendEvent: function(room_id, eventType, txn_id, content) {
            // The REST path spec
            var path = "/rooms/$room_id/send/"+eventType+"/$txn_id";

            if (!txn_id) {
                txn_id = "m" + new Date().getTime();
            }

            // Like the cmd client, escape room ids
            room_id = encodeURIComponent(room_id);            

            // Customize it
            path = path.replace("$room_id", room_id);
            path = path.replace("$txn_id", txn_id);

            return doRequest("PUT", path, undefined, content);
        },
        
        setTyping: function(room_id, isTyping, timeoutMs, user_id) {
            if (!user_id) {
                user_id = config.user_id;
            }
        
            var path = "/rooms/$room_id/typing/$user_id";
            path = path.replace("$room_id", encodeURIComponent(room_id));
            path = path.replace("$user_id", encodeURIComponent(user_id));
            
            var content;
            
            if (isTyping) {
                if (!timeoutMs) {
                    timeoutMs = DEFAULT_TYPING_TIMEOUT_MS;
                }
                
                content = {
                    typing: true,
                    timeout: timeoutMs
                };
            }
            else {
                content = {
                    typing: false
                };
            }
            
            return doRequest("PUT", path, undefined, content);
        },

        sendMessage: function(room_id, txn_id, content) {
            return this.sendEvent(room_id, 'm.room.message', txn_id, content);
        },

        // Send a text message
        sendTextMessage: function(room_id, body, msg_id) {
            var content = {
                 msgtype: "m.text",
                 body: body
            };

            return this.sendMessage(room_id, msg_id, content);
        },

        // Send an image message
        sendImageMessage: function(room_id, image_url, image_body, msg_id) {
            var content = {
                 msgtype: "m.image",
                 url: image_url,
                 info: image_body,
                 body: "Image"
            };

            return this.sendMessage(room_id, msg_id, content);
        },

        // Send an emote message
        sendEmoteMessage: function(room_id, body, msg_id) {
            var content = {
                 msgtype: "m.emote",
                 body: body
            };

            return this.sendMessage(room_id, msg_id, content);
        },

        redactEvent: function(room_id, event_id) {
            var path = "/rooms/$room_id/redact/$event_id";
            path = path.replace("$room_id", encodeURIComponent(room_id));
            // TODO: encodeURIComponent when HS updated.
            path = path.replace("$event_id", event_id);
            var content = {};
            return doRequest("POST", path, undefined, content);
        },

        // get a snapshot of the members in a room.
        getMemberList: function(room_id) {
            // Like the cmd client, escape room ids
            room_id = encodeURIComponent(room_id);

            var path = "/rooms/$room_id/members";
            path = path.replace("$room_id", room_id);
            return doRequest("GET", path);
        },
        
        paginateBackMessages: function(room_id, from_token, limit) {
            var path = "/rooms/$room_id/messages";
            path = path.replace("$room_id", encodeURIComponent(room_id));
            var params = {
                from: from_token,
                limit: limit,
                dir: 'b'
            };
            return doRequest("GET", path, params);
        },

        // get a list of public rooms on your home server
        publicRooms: function() {
            var path = "/publicRooms";
            return doRequest("GET", path);
        },
        
        // get a user's profile
        getProfile: function(userId) {
            return this.getProfileInfo(userId);
        },

        // get a display name for this user ID
        getDisplayName: function(userId) {
            return this.getProfileInfo(userId, "displayname");
        },

        // get the profile picture url for this user ID
        getProfilePictureUrl: function(userId) {
            return this.getProfileInfo(userId, "avatar_url");
        },

        // update your display name
        setDisplayName: function(newName) {
            var content = {
                displayname: newName
            };
            return this.setProfileInfo(content, "displayname");
        },

        // update your profile picture url
        setProfilePictureUrl: function(newUrl) {
            var content = {
                avatar_url: newUrl
            };
            return this.setProfileInfo(content, "avatar_url");
        },

        setProfileInfo: function(data, info_segment) {
            var path = "/profile/$user/" + info_segment;
            path = path.replace("$user", encodeURIComponent(config.user_id));
            return doRequest("PUT", path, undefined, data);
        },

        getProfileInfo: function(userId, info_segment) {
            var path = "/profile/"+encodeURIComponent(userId);
            if (info_segment) path += '/' + info_segment;
            return doRequest("GET", path);
        },
        
        login: function(userId, password) {
            // TODO We should be checking to make sure the client can support
            // logging in to this HS, else use the fallback.
            var path = "/login";
            var data = {
                "type": "m.login.password",
                "user": userId,
                "password": password  
            };
            return doRequest("POST", path, undefined, data);
        },

        // hit the Identity Server for a 3PID request.
        linkEmail: function(email, clientSecret, sendAttempt) {
            var path = "/_matrix/identity/api/v1/validate/email/requestToken";
            var data = "clientSecret="+clientSecret+"&email=" + encodeURIComponent(email)+"&sendAttempt="+sendAttempt;
            var headers = {};
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            return doBaseRequest(config.identityServer, "POST", path, {}, data, headers); 
        },

        authEmail: function(clientSecret, sid, code) {
            var path = "/_matrix/identity/api/v1/validate/email/submitToken";
            var data = "token="+code+"&sid="+sid+"&clientSecret="+clientSecret;
            var headers = {};
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            return doBaseRequest(config.identityServer, "POST", path, {}, data, headers);
        },

        bindEmail: function(userId, tokenId, clientSecret) {
            var path = "/_matrix/identity/api/v1/3pid/bind";
            var data = "mxid="+encodeURIComponent(userId)+"&sid="+tokenId+"&clientSecret="+clientSecret;
            var headers = {};
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            return doBaseRequest(config.identityServer, "POST", path, {}, data, headers); 
        },

        lookup3pid: function(medium, address) {
            var path = "/_matrix/identity/api/v1/lookup?medium="+encodeURIComponent(medium)+"&address="+encodeURIComponent(address);
            return doBaseRequest(config.identityServer, "GET", path, {}, undefined, {}); 
        },
        
        uploadContent: function(file) {
            var headers = {
                "Content-Type": undefined // undefined means angular will figure it out
            };
            
            var url = this.getContentUrl();

            // If the file is actually a Blob object, prevent $http from JSON-stringified it before sending
            // (Equivalent to jQuery ajax processData = false)
            var $httpParams;
            if (file instanceof Blob) {
                $httpParams = {
                    transformRequest: angular.identity
                };
            }

            return doBaseRequest(url.base, "POST", url.path, url.params, file, headers, $httpParams);
        },

        getIdenticonUri: function(identiconString, width, height) {
            if (!identiconString) {
                return;
            }
            if (!width) {
                width = 96;
            }
            if (!height) {
                height = 96;
            }
            var params = {
                width: width,
                height: height
            };

            var prefix = "/_matrix/media/v1/identicon/";
            return config.homeserver + prefix + encodeURIComponent(identiconString) + (Object.keys(params).length === 0 ? "" : ("?" + jQuery.param(params)));
        },
        
        /**
         * Get the content repository url with query parameters. This is useful
         * if you would prefer to upload content in a different way to 
         * matrixService.uploadContent(file) (e.g. for progress bars).
         * @returns An object with a 'base', 'path' and 'params' for base URL, 
         *          path and query parameters respectively.
         */
        getContentUrl: function() {
            var path = "/_matrix/media/v1/upload";
            
            var params = {
                access_token: config.access_token
            };
            return {
                base: config.homeserver,
                path: path,
                params: params
            };
        },
        
        getHttpUriForMxc: function(mxc, width, height, resizeMethod) {
            if (!typeof mxc === "string" || !mxc) {
                return mxc;
            }
            if (mxc.indexOf("mxc://") !== 0) {
                return mxc;
            }
            var serverAndMediaId = mxc.slice(6); // strips mxc://
            var prefix = "/_matrix/media/v1/download/";
            var params = {};
            
            if (width) {
                params.width = width;
            }
            if (height) {
                params.height = height;
            }
            if (resizeMethod) {
                params.method = resizeMethod;
            }
            if (Object.keys(params).length > 0) {
                // these are thumbnailing params so they probably want the thumbnailing API...
                prefix = "/_matrix/media/v1/thumbnail/";
            }

			var fragmentOffset = serverAndMediaId.indexOf("#"),
				fragment = "";
			if (fragmentOffset >= 0) {
				fragment = serverAndMediaId.substr(fragmentOffset);
				serverAndMediaId = serverAndMediaId.substr(0, fragmentOffset);
			}
            return config.homeserver + prefix + serverAndMediaId + (Object.keys(params).length === 0 ? "" : ("?" + jQuery.param(params))) + fragment;
        },
        

        /**
         * Start listening on /events
         * @param {String} from the token from which to listen events to
         * @param {Integer} serverTimeout the time in ms the server will hold open the connection
         * @param {Integer} clientTimeout the timeout in ms used at the client HTTP request level
         * @returns a promise
         */
        getEventStream: function(from, serverTimeout, clientTimeout) {
            var path = "/events";
            var params = {
                from: from,
                timeout: serverTimeout
            };

            var $httpParams;
            if (clientTimeout) {
                // If the Internet connection is lost, this timeout is used to be able to
                // cancel the current request and notify the client so that it can retry with a new request.
                $httpParams = {
                    timeout: clientTimeout
                };
            }

            return doRequest("GET", path, params, undefined, $httpParams);
        },

        // Indicates if user authentications details are stored in cache
        isUserLoggedIn: function() {
            var config = this.config();

            // User is considered logged in if his cache is not empty and contains
            // an access token
            if (config && config.access_token) {
                return true;
            }
            else {
                return false;
            }
        },
        
        // Enum of presence state
        presence: {
            offline: "offline",
            unavailable: "unavailable",
            online: "online",
            free_for_chat: "free_for_chat"
        },
        
        // Set the logged in user presence state
        setUserPresence: function(presence) {
            var path = "/presence/$user_id/status";
            path = path.replace("$user_id", encodeURIComponent(config.user_id));
            return doRequest("PUT", path, undefined, {
                presence: presence
            });
        },
        
        
        /****** Permanent storage of user information ******/
        
        // Returns the current config
        config: function() {
            return loadConfig();
        },
        
        // Set a new config (Use saveConfig to actually store it permanently)
        setConfig: function(newConfig) {
            config = newConfig;
        },
        
        // Commits config into permanent storage
        saveConfig: function() {
            storeConfig();
        },
            
        /**
         * Change or reset the power level of a user
         * @param {String} room_id the room id
         * @param {String} user_id the user id
         * @param {Number} powerLevel The desired power level.
         *    If undefined, the user power level will be reset, ie he will use the default room user power level
         * @param event The existing m.room.power_levels event if one exists.
         * @returns {promise} an $http promise
         */
        setUserPowerLevel: function(room_id, user_id, powerLevel, event) {
            var content = {
                users: {}
            };
            if (event) {
                // if there is an existing event, copy the content as it contains
                // the power level values for other members which we do not want
                // to modify.
                content = angular.copy(event.content);
            }
            content.users[user_id] = powerLevel;
                
            var path = "/rooms/$room_id/state/m.room.power_levels";
            path = path.replace("$room_id", encodeURIComponent(room_id));
                
            return doRequest("PUT", path, undefined, content);
        },

        getTurnServer: function() {
            return doRequest("GET", "/voip/turnServer");
        },

        getPushRules: function() {
            return doRequest("GET", "/pushrules/");
        },

        addPushRule: function(scope, kind, rule_id, body) {
            // NB. Scope not uri encoded because devices need the '/'
            var path = "/pushrules/"+scope+"/"+encodeURIComponent(kind)+
                "/"+encodeURIComponent(rule_id);
            return doRequest("PUT", path, undefined, body);
        },

        deletePushRule: function(scope, kind, rule_id) {
            var path = "/pushrules/"+scope+"/"+encodeURIComponent(kind)+
                "/"+encodeURIComponent(rule_id);
            return doRequest("DELETE", path);
        }

    };
}]);
