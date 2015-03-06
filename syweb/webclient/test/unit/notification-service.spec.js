describe('NotificationService', function() {

    var testUserId = "@ali:matrix.org";
    var testDisplayName = "Alice M";
    var testOtherDisplayName = "Jimmy McSomeoneelse";
    var testRoomId = "!fl1bb13:localhost";

    var testEvent;

    var matrixService = {
        getPushRules : function() {
            var def = $q.defer();
            var rulesets = {
                "device": {},
                "global": {
                    "content": [
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "sound",
                                    "value": "default"
                                },
                                {
                                    "set_tweak": "highlight"
                                }
                            ],
                            "enabled": true,
                            "pattern": "ali",
                            "rule_id": ".m.rule.contains_user_name"
                        },
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "sound",
                                    "value": "default"
                                },
                                {
                                    "set_tweak": "highlight"
                                }
                            ],
                            "enabled": true,
                            "pattern": "coffee",
                            "rule_id": "coffee"
                        },
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "sound",
                                    "value": "default"
                                },
                                {
                                    "set_tweak": "highlight"
                                }
                            ],
                            "enabled": true,
                            "pattern": "foo*bar",
                            "rule_id": "foobar"
                        },
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "sound",
                                    "value": "default"
                                },
                                {
                                    "set_tweak": "highlight"
                                }
                            ],
                            "enabled": true,
                            "pattern": "p[io]ng",
                            "rule_id": "pingpong"
                        },
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "sound",
                                    "value": "default"
                                },
                                {
                                    "set_tweak": "highlight"
                                }
                            ],
                            "enabled": true,
                            "pattern": "I ate [0-9] pies",
                            "rule_id": "pies"
                        },
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "sound",
                                    "value": "default"
                                },
                                {
                                    "set_tweak": "highlight"
                                }
                            ],
                            "enabled": true,
                            "pattern": "b[!ai]ke",
                            "rule_id": "bakebike"
                        }
                    ],
                    "override": [
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "sound",
                                    "value": "default"
                                },
                                {
                                    "set_tweak": "highlight"
                                }
                            ],
                            "conditions": [
                                {
                                    "kind": "contains_display_name"
                                }
                            ],
                            "enabled": true,
                            "rule_id": ".m.rule.contains_display_name"
                        },
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "sound",
                                    "value": "default"
                                }
                            ],
                            "conditions": [
                                {
                                    "is": "2",
                                    "kind": "room_member_count"
                                }
                            ],
                            "enabled": true,
                            "rule_id": ".m.rule.room_one_to_one"
                        }
                    ],
                    "room": [],
                    "sender": [],
                    "underride": [
                        {
                            "actions": [
                                "dont-notify"
                            ],
                            "conditions": [
                                {
                                    "key": "content.msgtype",
                                    "kind": "event_match",
                                    "pattern": "m.notice"
                                }
                            ],
                            "enabled": true,
                            "rule_id": ".m.rule.suppress_notices"
                        },
                        {
                            "actions": [
                                "notify",
                                {
                                    "set_tweak": "highlight",
                                    "value": false
                                }
                            ],
                            "conditions": [],
                            "enabled": true,
                            "rule_id": ".m.rule.fallback"
                        }
                    ]
                }
            };
            def.resolve({'data': rulesets});
            return def.promise;
        },
        config : function() {
            return {'user_id': testUserId};
        }
    };

    var modelService = {
        getRooms: function(){},
        getKnownRoom: function(room_id) {
            var testRoom = {
                room_id: testRoomId,
                old_room_state: {},
                current_room_state: {
                    state_events: {},
                    members: []
                },
                events: []
            };
            return testRoom;
        }
    };

    var mPresence = {
        getState: function() {
            return testPresenceState;
        }
    };

    beforeEach(function() {
        testEvent = {
            content: {
                body: "",
                msgtype: "m.text"
            },
            user_id: "@alfred:localhost",
            room_id: testRoomId,
            event_id: "fwuegfw@localhost"
        };

        // mocked dependencies
        module(function ($provide) {
          $provide.value('matrixService', matrixService);
          $provide.value('modelService', modelService);
          $provide.value('mPresence', mPresence);
        });

        module(function ($filterProvider) {
            // fake filter
            $filterProvider.register('mUserDisplayName', function() {
                return function(user_id, room_id) {
                    if (user_id === testUserId) {
                        return testDisplayName;
                    }
                    return testOtherDisplayName;
                };
            });
        });

        module('notificationService');
    });

    beforeEach(inject(function($rootScope, _$q_) {
        scope = $rootScope;
        $q = _$q_;
    }));

    beforeEach(inject(function(notificationService) {
        notificationService.getRulesets();
        scope.$apply();
    }));
    
    // User IDs
    
    it('should bing on a user ID.', inject(
    function(notificationService) {
        testEvent.content.body = "Hello @ali:matrix.org, how are you?";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));
    
    it('should bing on a partial user ID with an @.', inject(
    function(notificationService) {
        testEvent.content.body = "Hello @ali, how are you?";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));

    it('should bing on a partial user ID without @.', inject(
    function(notificationService) {
        testEvent.content.body = "Hello ali, how are you?";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));
    
    it('should bing on a case-insensitive user ID.', inject(
    function(notificationService) {
        testEvent.content.body = "Hello @AlI:matrix.org, how are you?";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));
    
    // Display names
    
    it('should bing on a display name.', inject(
    function(notificationService) {
        testEvent.content.body = "Hello Alice M, how are you?";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));
    
    it('should bing on a case-insensitive display name.', inject(
    function(notificationService) {
        testEvent.content.body = "Hello ALICE M, how are you?";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));
    
    // Bing words
    
    it('should bing on a bing word.', inject(
    function(notificationService) {
        testEvent.content.body = "I really like coffee";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));
    
    it('should bing on case-insensitive bing words.', inject(
    function(notificationService) {
        testEvent.content.body = "Coffee is great";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));
    
    it('should bing on wildcard (.*) bing words.', inject(
    function(notificationService) {
        testEvent.content.body = "It was foomahbar I think.";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));

    it('should bing on character group ([abc]) bing words.', inject(
    function(notificationService) {
        testEvent.content.body = "Ping!";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
        testEvent.content.body = "Pong!";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));

    it('should bing on character range ([a-z]) bing words.', inject(
    function(notificationService) {
        testEvent.content.body = "I ate 6 pies";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
    }));

    it('should bing on character negation ([!a]) bing words.', inject(
    function(notificationService) {
        testEvent.content.body = "boke";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(true);
        testEvent.content.body = "bake";
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(false);
    }));
    
    // invalid
    
    it('should gracefully handle bad input.', inject(
    function(notificationService) {
        testEvent.content.body = { "foo": "bar" };
        expect(notificationService.shouldHighlightEvent(testEvent)).toEqual(false);
    }));
});
