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
angular.module('notificationService', [])
.factory('notificationService', ['$timeout', '$q', '$rootScope', 'matrixService', 'modelService', 'mPresence', 'mUserDisplayNameFilter', 'mRoomNameFilter',
function($timeout, $q, $rootScope, matrixService, modelService, mPresence, mUserDisplayNameFilter, mRoomNameFilter) {

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

    var escapeRegExp = function(string){
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    var rulesCache = null;
    var rulesCacheIsCurrent = false;
    var ruleFetchPromise = null;

    var matchingRuleFromKindSet = function(ev, kindset, device) {
        var rulekinds_in_order = ['override', 'content', 'room', 'sender', 'underride'];
        for (var ruleKindIndex = 0; ruleKindIndex < rulekinds_in_order.length; ++ruleKindIndex) {
            var kind = rulekinds_in_order[ruleKindIndex];
            var ruleset = kindset[kind];

            for (var ruleIndex = 0; ruleIndex < ruleset.length; ++ruleIndex) {
                var rule = ruleset[ruleIndex];
                if (!rule.enabled) continue;

                var rawrule = templateRuleToRaw(kind, rule, device);
                if (!rawrule) continue;

                if (ruleMatchesEvent(rawrule, ev)) {
                    rule.kind = kind;
                    return rule;
                }
            };
        };
        return null;
    };

    var templateRuleToRaw = function(kind, tprule, device) {
        var rawrule = {
            'rule_id': tprule.rule_id,
            'actions': tprule.actions,
            'conditions': []
        };
        switch (kind) {
            case 'underride':
            case 'override':
                rawrule.conditions = tprule.conditions;
                break;
            case 'room':
                if (!tprule.rule_id) return null;
                rawrule.conditions.push({
                    'kind': 'event_match',
                    'key': 'room_id',
                    'pattern': tprule.rule_id
                });
                break;
            case 'sender':
                if (!tprule.rule_id) return null;
                rawrule.conditions.push({
                    'kind': 'event_match',
                    'key': 'user_id',
                    'pattern': tprule.rule_id
                });
                break;
            case 'content':
                if (!tprule.pattern) return null;
                rawrule.conditions.push({
                    'kind': 'event_match',
                    'key': 'content.body',
                    'pattern': tprule.pattern
                });
                break;
        }
        if (device) {
            rawrule.conditions.push({
                'kind': 'device',
                'profile_tag': device,
            });
        }
        return rawrule;
    };

    var ruleMatchesEvent = function(rule, ev) {
        var ret = true;
        angular.forEach(rule.conditions, function(cond) {
            ret &= eventFulfillsCondition(cond, ev);
        });
        //console.log("Rule "+rule.rule_id+(ret ? " matches" : " doesn't match"));
        return ret;
    };

    var eventFulfillsCondition = function(cond, ev) {
        var condition_functions = {
            "event_match": eventFulfillsEventMatchCondition,
            "device": eventFulfillsDeviceCondition,
            "contains_display_name": eventFulfillsDisplayNameCondition,
            "room_member_count": eventFulfillsRoomMemberCountCondition
        };
        if (condition_functions[cond.kind]) return condition_functions[cond.kind](cond, ev);
        return true;
    };

    var eventFulfillsRoomMemberCountCondition = function(cond, ev) {
        if (!cond.is) return false;

        var room = modelService.getKnownRoom(ev.room_id);
        if (!room || !room.current_room_state || !room.current_room_state.members) return false;

        var memberCount = Object.keys(room.current_room_state.members).length;

        var m = cond.is.match(/^([=<>]*)([0-9]*)$/);
        if (!m) return false;
        var ineq = m[1];
        var rhs = parseInt(m[2]);
        if (isNaN(rhs)) return false;
        switch (ineq) {
            case '':
            case '==':
                return memberCount == rhs;
            case '<':
                return memberCount < rhs;
            case '>':
                return memberCount > rhs;
            case '<=':
                return memberCount <= rhs;
            case '>=':
                return memberCount >= rhs;
            default:
                return false;
        }
    };

    var eventFulfillsDisplayNameCondition = function(cond, ev) {
        if (!ev.content || ! ev.content.body || typeof ev.content.body != 'string') return false;

        var displayname = mUserDisplayNameFilter(matrixService.config().user_id, ev.room_id);
        var pat = new RegExp("\\b"+escapeRegExp(displayname)+"\\b", 'i')
        return ev.content.body.search(pat) > -1;
    };

    var eventFulfillsDeviceCondition = function(cond, ev) {
        return false; // XXX: Allow a profile tag to be set for the web client instance
    };

    var eventFulfillsEventMatchCondition = function(cond, ev) {
        var pat;
        // apparently we only apply word boundaries for content.body matches
        // otherwise the whoe thing must match (this is the synapse impl)
        if (cond.key == 'content.body') {
            pat = '\\b'+globToRegexp(cond.pattern)+'\\b';
        } else {
            pat = '^'+globToRegexp(cond.pattern)+'$';
        }
        var val = valueForDottedKey(cond['key'], ev);
        if (!val || typeof val != 'string') return false;
        var regex = new RegExp(pat, 'i');
        return !!val.match(regex);
    };

    var globToRegexp = function(glob) {
        // From https://github.com/matrix-org/synapse/blob/abbee6b29be80a77e05730707602f3bbfc3f38cb/synapse/push/__init__.py#L132
        var pat = escapeRegExp(glob);
        pat = pat.replace(/\\\*/, '.*');
        pat = pat.replace(/\?/, '.');
        pat = pat.replace(/\\\[(!|)(.*)\\]/, function(match, p1, p2, offset, string) {
            var first = p1 && '^' || '';
            var second = p2.replace(/\\\-/, '-');
            return '['+first+second+']';
        });
        return pat;
    };

    var valueForDottedKey = function(key, ev) {
        var parts = key.split('.');
        var val = ev;
        while (parts.length > 0) {
            var thispart = parts.shift();
            if (!val[thispart]) return null;
            val = val[thispart];
        }
        return val;
    };

    var notificationMessageForEvent = function(ev, displayname) {
        var message = null;

        if (ev.type === "m.room.message") {
            message = ev.content.body;
            if (ev.content.msgtype === "m.emote") {
                message = "* " + displayname + " " + message;
            } else if (ev.content.msgtype === "m.image") {
                message = displayname + " sent an image.";
            }
        } else if (ev.type == "m.room.member") {
            if (ev.state_key !== matrixService.config().user_id  && "join" === ev.content.membership) {
                // Notify when another user joins
                displayname = mUserDisplayNameFilter(ev.state_key, ev.room_id);
                message = displayname + " joined";
            } else if (ev.state_key === matrixService.config().user_id  && "invite" === ev.content.membership) {
                // notify when you are invited
                message = displayname + " invited you to a room";
            }
        }
        return message;
    };

    var matchingRuleForEventWithRulesets = function(ev, rulesets) {
        if (!rulesets) return null;
        if (ev.user_id == matrixService.config().user_id) return null;
        angular.forEach(rulesets.device, function(devname, devrules) {
            var matchingRule = matchingRuleFromKindSet(devrules, devname);
            if (matchingRule) defer.resolve(matchingRule);
        });
        return matchingRuleFromKindSet(ev, rulesets.global);
    };

    var matchingRuleForEventNow = function(ev) {
        // Returns a matching rule for this event with whatever rules
        // we have cached right now (ie. it might be total rubbish)
        return matchingRuleForEventWithRulesets(ev, rulesCache);
    };

    var shouldHighlightEventWithRule = function(ev, rule) {
        var actionObj = actionListToActionsObject(rule.actions);
        if (!actionObj.notify) return false;

        if (actionObj.tweaks.highlight == undefined) {
            // if it isn't specified, we highlight
            return true;
        }

        return !!actionObj.tweaks.highlight;
    };

    var actionListToActionsObject = function(actionlist) {
        var actionobj = { 'notify': false, 'tweaks': {} };
        angular.forEach(actionlist, function(action) {
            if (action === 'notify') {
                actionobj.notify = true;
            } else if (typeof action === 'object') {
                if (action.value == undefined) action.value = true;
                actionobj.tweaks[action.set_tweak] = action.value;
            }
        });
        return actionobj;
    };

    var showNotification = function(title, body, icon, onclick, tag, audioNotification) {
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
    };
    

    var self = {

        clearRulesCache : function() {
            rulesCacheIsCurrent = false;
        },

        getRulesets : function() {
            var def = $q.defer();

            if (!rulesCacheIsCurrent && !ruleFetchPromise)  {
                ruleFetchPromise = def.promise;
                matrixService.getPushRules().then(function(rules) {
                    rulesCache = rules.data;
                    rulesCacheIsCurrent = true;
                    def.resolve(rulesCache);
                }, function(err) {
                    def.reject(err);
                }).finally(function() {
                    ruleFetchPromise = null;
                });
            } else if (ruleFetchPromise) {
                ruleFetchPromise.then(function(rules) {
                    def.resolve(rulesCache);
                });
            } else {
                def.resolve(rulesCache);
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

        deleteGlobalContentRule : function(rule_id) {
            return matrixService.deletePushRule('global', 'content', rule_id);
        },

        deleteGlobalRoomRule : function(room_id) {
            return matrixService.deletePushRule('global', 'room', room_id);
        },

        deleteGlobalSenderRule : function(sender_id) {
            return matrixService.deletePushRule('global', 'sender', sender_id);
        },

        matchingRuleForEvent : function(ev) {
            var def = $q.defer();
            this.getRulesets().then(function(rulesets) {
                def.resolve(matchingRuleForEventWithRulesets(ev, rulesets));
            });
            return def.promise;
        },

        ifShouldHighlightEvent : function(ev) {
            var def = $q.defer();
            this.matchingRuleForEvent(ev).then(function(rule) {
                if (!rule) return false;
                if (shouldHighlightEventWithRule(ev, rule)) {
                    def.resolve();
                } else {
                    def.reject();
                }
            });
            return def.promise;
        },

        shouldHighlightEvent : function(ev) {
            var rule = matchingRuleForEventNow(ev);
            if (!rule) return false;
            return shouldHighlightEventWithRule(ev, rule);
        },

        processEvent : function(ev) {
            if (matrixService.config().muteNotifications) {
                //console.log("Notifications muted");
                return;
            }
            // Ideally we would notify only when the window is hidden (i.e. document.hidden = true).
            //
            // However, Chrome on Linux and OSX currently returns document.hidden = false unless the window is
            // explicitly showing a different tab.  So we need another metric to determine hiddenness - we
            // simply use idle time.  If the user has been idle enough that their presence goes to idle, then
            // we also display notifs when things happen.
            //
            // This is far far better than notifying whenever anything happens anyway, otherwise you get spammed
            // to death with notifications when the window is in the foreground, which is horrible UX (especially
            // if you have not defined any bingers and so get notified for everything).
            var isIdle = (document.hidden || matrixService.presence.unavailable === mPresence.getState());
            if (!isIdle) {
                //console.log("Document visible: not showing notification");
                return;
            }

            this.matchingRuleForEvent(ev).then(function(rule) {
                if (!rule) {
                    //console.log("No matching rule: not notifying");
                    return; // This is essentially making the default 'dont-notify'
                }

                var actionObj = actionListToActionsObject(rule.actions);
                
                if (actionObj.notify) {
                    var roomTitle = mRoomNameFilter(ev.room_id);
                    
                    var audio = undefined;
                    if (matrixService.config().audioNotifications === true && actionObj.tweaks.sound) {
                        var audioEl = angular.element(actionObj.tweaks.sound);
                        if (audioEl && audioEl.prop("tagName") === 'AUDIO') {
                            audio = actionObj.tweaks.sound;
                        } else {
                            audio = "default";
                        }
                    }

                    var member = modelService.getMember(ev.room_id, ev.user_id);
                    var avatarUrl;
                    if (member.event.content.avatar_url) {
                        avatarUrl = matrixService.getHttpUriForMxc(member.event.content.avatar_url);
                    }

                    var displayname = mUserDisplayNameFilter(ev.user_id, ev.room_id);
                    
                    var message = notificationMessageForEvent(ev, displayname);
                    if (!message) return;

                    console.log("Displaying notification "+(audio === undefined ? "" : "with audio")+" for "+JSON.stringify(ev.content));

                    var notificationTitle;
                    if (roomTitle == displayname) {
                        notificationTitle = displayname;
                    } else {
                        notificationTitle = displayname + " (" + roomTitle + ")";
                    }
                    
                    showNotification(
                        notificationTitle,
                        message,
                        avatarUrl,
                        function() {
                            console.log("notification.onclick() room=" + ev.room_id);
                            $rootScope.goToPage('room/' + ev.room_id); 
                        },
                        undefined,
                        audio
                    );
                }
            });
        },
        
        showNotification : showNotification,
    };
    self.getRulesets();
    return self;
}]);

