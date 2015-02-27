/*
Copyright 2014,2015 OpenMarket Ltd

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
This service manages notifications: enabling, creating and showing them. This
also contains 'bing word' logic.
*/
angular.module('notificationService', ['matrixService'])
.factory('notificationService', ['$timeout', '$q', 'matrixService', function($timeout, $q, matrixService) {

    var getLocalPartFromUserId = function(user_id) {
        if (!user_id) {
            return null;
        }
        var localpartRegex = /@(.*):\w+/i
        var results = localpartRegex.exec(user_id);
        if (results && results.length == 2) {
            return results[1];
        }
        return null;
    };
    
    var playAudio = function(clip) {
        if (clip === "default") {
            clip = "#incomingMessage";
        }
        var e = angular.element(clip);
        if (e && e[0]) {
            e = e[0];
            e.load();
            e.play();
            return e;
        }
    };

    var rulesCache = null;
    var ruleFetchPromise = null;
    
    return {

        clearRulesCache : function() {
            rulesCache = null;
        },

        getGlobalRulesets : function() {
            var def = $q.defer();

            if (!rulesCache && !ruleFetchPromise)  {
                ruleFetchPromise = def.promise;
                matrixService.getPushRules().then(function(rules) {
                    rulesCache = rules.data;
                    def.resolve(rulesCache.global);
                }, function(err) {
                    def.reject(err);
                }).finally(function() {
                    ruleFetchPromise = null;
                });
            } else if (ruleFetchPromise) {
                ruleFetchPromise.then(function(rules) {
                    def.resolve(rulesCache.global);
                });
            } else {
                def.resolve(rulesCache.global);
            }
            return def.promise;
        },

        addGlobalContentRule : function(pattern, actions) {
            var doIt = function() {
                var body = {
                    pattern: pattern,
                    actions: actions
                }
                var suff = 0;
                var rule_id = null; 

                var currentIds = [];
                for (var i = 0; i < rulesCache.global.content.length; i++) {
                    currentIds.push(rulesCache.global.content[i].rule_id);
                }

                var specialchars = ['*', '[', ']', '?', '!'];

                do {
                    rule_id = pattern;
                    for (var i = 0; i < specialchars.length; ++i) {
                        rule_id = rule_id.replace(specialchars[i], '');
                    }
                    if (suff > 0) {
                        rule_id += suff++;
                    }
                    ++suff;
                } while (currentIds.indexOf(rule_id) > -1 || rule_id == '');
                return matrixService.addPushRule('global', 'content', rule_id, body);
            };

            if (!rulesCache) {
                return this.getGlobalRulesets().then(doIt);
            } else {
                return doIt();
            }
        },

        addGlobalRoomRule : function(room_id, actions) {
            var body = {
                actions: actions
            }
            return matrixService.addPushRule('global', 'room', room_id, body);
        },

        addGlobalSenderRule : function(sender_id, actions) {
            var body = {
                actions: actions
            }
            return matrixService.addPushRule('global', 'sender', sender_id, body);
        },

        deleteGlobalContentRule: function(rule_id) {
            return matrixService.deletePushRule('global', 'content', rule_id);
        },

        deleteGlobalRoomRule: function(room_id) {
            return matrixService.deletePushRule('global', 'room', room_id);
        },

        deleteGlobalSenderRule: function(sender_id) {
            return matrixService.deletePushRule('global', 'sender', sender_id);
        },
    
        containsBingWord: function(userId, displayName, bingWords, content) {
            // case-insensitive name check for user_id OR display_name if they exist
            var userRegex = "";
            if (userId) {
                var localpart = getLocalPartFromUserId(userId);
                if (localpart) {
                    localpart = localpart.toLocaleLowerCase();
                    userRegex += "\\b" + localpart + "\\b";
                }
            }
            if (displayName) {
                displayName = displayName.toLocaleLowerCase();
                if (userRegex.length > 0) {
                    userRegex += "|";
                }
                userRegex += "\\b" + displayName + "\\b";
            }

            var regexList = [new RegExp(userRegex, 'i')];
            
            // bing word list check
            if (bingWords && bingWords.length > 0) {
                for (var i=0; i<bingWords.length; i++) {
                    var re = RegExp(bingWords[i], 'i');
                    regexList.push(re);
                }
            }
            return this.hasMatch(regexList, content);
        },
    
        hasMatch: function(regExps, content) {
            if (!content || $.type(content) != "string") {
                return false;
            }
            
            if (regExps && regExps.length > 0) {
                for (var i=0; i<regExps.length; i++) {
                    if (content.search(regExps[i]) != -1) {
                        return true;
                    }
                }
            }
            return false;
        },
        
        showNotification: function(title, body, icon, onclick, tag, audioNotification) {
            if (!tag) {
                tag = "matrix";
            }
            var notification = new window.Notification(
                title,
                {
                    "body": body,
                    "icon": icon,
                    "tag": tag
                }
            );

            if (onclick) {
                notification.onclick = onclick;
            }
            
            var audioClip;
            
            if (audioNotification) {
                audioClip = playAudio(audioNotification);
            }

            $timeout(function() {
                notification.close();
                if (audioClip) {
                    audioClip.pause();
                }
            }, 5 * 1000);
        }
    };

}]);
