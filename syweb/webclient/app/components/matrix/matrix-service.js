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
.factory('matrixService', ['$http', '$window', '$timeout', '$q', 
function($http, $window, $timeout, $q) {
        
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
    
    // Current version of permanent storage
    var configVersion = 0;
    var prefixPath = "/_matrix/client/api/v1";
    var prefixPathV2 = "/_matrix/client/v2_alpha";
    var handleRateLimiting = true;
    var rateLimitMaxMs = 1000 * 20; // 20s
    
    var DEFAULT_TYPING_TIMEOUT_MS = 20000;

    var client;
    if (!$window.matrixcs) {
        console.error("Missing matrix.js!");
    }

    var initClient = function(url, token, userId) {
        // inject an AngularJS compatible request module
        $window.matrixcs.request(function(opts, callback) {
            // return a promise rather than use callbacks
            return doInternalRequest(opts.uri, opts.method, opts.qs, opts.body, undefined, {
                timeout: 35000
            });
        });

        client = $window.matrixcs.createClient({
            baseUrl: url,
            accessToken: token,
            userId: userId
        });
    };

    var initFromConfig = function() {
        if (!config) {
            loadConfig();
        }
        if (config) {
            initClient(config.homeserver, config.access_token, config.user_id);
        }
        else {
            console.error("No config to init client");
        }
    };
    initFromConfig();

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

    // temporary mess for v1/v2 transition
    var doV2Request = function(method, path, params, data, $httpParams) {
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
        
        if (path.indexOf(prefixPathV2) !== 0) {
            path = prefixPathV2 + path;
        }
        
        return doBaseRequest(config.homeserver, method, path, params, data, undefined, $httpParams);
    };

    var doInternalRequest = function(uri, method, params, data, headers, $httpParams) {
        var request = {
            method: method,
            url: uri,
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

    var doBaseRequest = function(baseUrl, method, path, params, data, headers, $httpParams) {
        return doInternalRequest(baseUrl + path, method, params, data, headers, $httpParams);
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
            var opts = {
                visibility: visibility
            };
            if (room_alias) {
                opts.room_alias_name = room_alias;
            }
            if (inviteList) {
                opts.invite = inviteList;
            }
            return client.createRoom(opts);
        },

        // Get the user's current state: his presence, the list of his rooms with
        // the last {limit} events
        initialSync: function(limit, feedback) {
            return client.initialSync(limit);
        },
        
        // get room state for a specific room
        roomState: function(room_id) {
            return client.roomState(room_id);
        },
        
        // get room initialSync for a specific room
        roomInitialSync: function(room_id, limit) {
            return client.roomInitialSync(room_id, limit);
        },

        join: function(room_alias_or_id) {
            return client.joinRoom(room_alias_or_id);
        },
        
        // Invite a user to a room
        invite: function(room_id, user_id) {
            return client.invite(room_id, user_id);
        },

        // Leaves a room
        leave: function(room_id) {
            return client.leave(room_id);
        },
           
        // Bans a user from a room
        ban: function(room_id, user_id, reason) {
            return client.ban(room_id, user_id, reason);
        },
        
        // Unbans a user in a room
        unban: function(room_id, user_id) {
            return client.unban(room_id, user_id);
        },
        
        // Kicks a user from a room
        kick: function(room_id, user_id, reason) {
            return client.kick(room_id, user_id, reason);
        },
        
        resolveRoomAlias:function(room_alias) {
            return client.resolveRoomAlias(room_alias);
        },
        
        setName: function(room_id, name) {
            return client.setRoomName(room_id, name);
        },
        
        setTopic: function(room_id, topic) {
            return client.setRoomTopic(room_id, topic);
        },
        
        sendStateEvent: function(room_id, eventType, content, state_key) {
            return client.sendStateEvent(room_id, eventType, content, state_key);
        },

        sendEvent: function(room_id, eventType, txn_id, content) {
            return client.sendEvent(room_id, eventType, content, txn_id);
        },
        
        setTyping: function(room_id, isTyping, timeoutMs, user_id) {
            return client.sendTyping(room_id, isTyping, timeoutMs);
        },

        sendMessage: function(room_id, txn_id, content) {
            return client.sendMessage(room_id, content, txn_id);
        },

        sendTextMessage: function(room_id, body, msg_id) {
            return client.sendTextMessage(room_id, body, msg_id);
        },

        sendImageMessage: function(room_id, image_url, image_body, msg_id) {
            return client.sendImageMessage(room_id, image_url, image_body);
        },

        sendEmoteMessage: function(room_id, body, msg_id) {
            return client.sendEmoteMessage(room_id, body, msg_id);
        },
        
        sendHtmlMessage: function(room_id, body, htmlBody) {
            return client.sendHtmlMessage(room_id, body, htmlBody);
        },

        redactEvent: function(room_id, event_id) {
            return client.redactEvent(room_id, event_id);
        },
        
        paginateBackMessages: function(room_id, from_token, limit) {
            return client.scrollback(room_id, from_token, limit);
        },

        // get a list of public rooms on your home server
        publicRooms: function() {
            return client.publicRooms();
        },
        
        // get a user's profile
        getProfile: function(userId) {
            return client.getProfileInfo(userId);
        },

        // get a display name for this user ID
        getDisplayName: function(userId) {
            return client.getProfileInfo(userId, "displayname");
        },

        // get the profile picture url for this user ID
        getProfilePictureUrl: function(userId) {
            return client.getProfileInfo(userId, "avatar_url");
        },

        // update your display name
        setDisplayName: function(newName) {
            return client.setDisplayName(newName);
        },

        // update your profile picture url
        setProfilePictureUrl: function(newUrl) {
            return client.setAvatarUrl(newUrl);
        },
        
        login: function(userId, password) {
            // TODO We should be checking to make sure the client can support
            // logging in to this HS, else use the fallback.
            return client.loginWithPassword(userId, password);
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
            return client.getIdenticonUri(identiconString, width, height);
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
            return client.getHttpUriForMxc(mxc, width, height, resizeMethod);
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
            return client.setPresence(presence);
        },
        
        
        /****** Permanent storage of user information ******/
        
        // Returns the current config
        config: function() {
            return loadConfig();
        },
        
        // Set a new config (Use saveConfig to actually store it permanently)
        setConfig: function(newConfig) {
            config = newConfig;
            initFromConfig();
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
            return client.setPowerLevel(room_id, user_id, powerLevel, event);
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
        },

        setPushRuleEnabled: function(scope, kind, rule_id, enabled) {
            var path = "/pushrules/"+scope+"/"+encodeURIComponent(kind)+
                "/"+encodeURIComponent(rule_id)+"/enabled";
            return doRequest("PUT", path, undefined, enabled ? 'true' : 'false');
        },

        setPassword: function(newPassword, authDict) {
            var body = {'auth': authDict, 'new_password': newPassword}
            return doV2Request("POST", "/account/password", undefined, body);
        }
    };
}]);
