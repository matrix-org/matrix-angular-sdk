describe('EventHandlerService', function() {
    var scope, q, timeout;
    
    var testContainsBingWords, testPresenceState; // mPresence, notificationService
    var testUserId, testDisplayName, testBingWords; // matrixService.config
    var testResolvedRoomId, testJoinSuccess, testRoomState; // matrixService
    var testNowState, testOldState, testEvents; // modelService
    
    var modelService = {
        getRoom: function(roomId) {
            return {
                room_id: roomId,
                current_room_state: testNowState,
                old_room_state: testOldState,
                events: testEvents,
                addMessageEvent: function(event, toFront) {
                    if (toFront) {
                        testEvents.unshift(event);
                    }
                    else {
                        testEvents.push(event);
                    }
                }
            };
        },
        createRoomIdToAliasMapping: function(roomId, alias) {
        
        },
        getMember: function(roomId, userId) {
        
        },
        setUser: function(presenceEvent) {
        
        }
    };
    
    var matrixService = {
        resolveRoomAlias: function(alias) {
            var defer = q.defer();
            if (testResolvedRoomId) {
                defer.resolve({ data: { room_id: testResolvedRoomId} });
            }
            else {
                defer.reject({ data: { error: "some resolveRoomAlias error", errcode: "M_UNKNOWN" } });
            }
            return defer.promise;
        },
        join: function(roomId) {
            var defer = q.defer();
            if (testJoinSuccess) {
                defer.resolve({});
            }
            else {
                defer.reject({ data: { error: "some join error", errcode: "M_UNKNOWN" } });
            }
            return defer.promise;
        },
        roomInitialSync: function(roomId) {
            var defer = q.defer();
            if (testRoomState) {
                defer.resolve({ data: {
                    state: testRoomState,
                    presence: []
                }});
            }
            else {
                defer.reject({ data: { error: "some roomState error", errcode: "M_UNKNOWN" } });
            }
            return defer.promise;
        },
        config: function() {
            return {
                user_id: testUserId,
                display_name: testDisplayName,
                bingWords: testBingWords
            };
        },
        presence: { unavailable: "unavailable", online: "online" }
    };
    
    var notificationService = {
        containsBingWord: function(user_id, display_name, bing_words) {
            return testContainsBingWords;
        },
        showNotification: function(title, msg, pic, onclick) {
        
        }
    };
    
    var mPresence = {
        getState: function() {
            return testPresenceState;
        }
    };

    // setup the service and mocked dependencies
    beforeEach(function() {
        // reset test vars
        testContainsBingWords = false;
        testPresenceState = matrixService.presence.unavailable;
        
        testUserId = "@me:matrix.org";
        testDisplayName = "Me";
        testBingWords = [];
        
        testJoinSuccess = true;
        testResolvedRoomId = "!foo:matrix.org";
        testRoomState = [];
        testEvents = [];
        testInitialSync = {
            data: {
                rooms: [],
                presence: []
            }
        };
        
        testNowState = {
            members: {},
            s: {},
            state: function(t,k) { 
                return k ? this.s[t+k] : this.s[t]; 
            },
            getStateEvent: function(t,k) {
                return this.state(t,k);
            },
            storeStateEvents: function(events) {
                if (!events) { return; }
                for (var i=0; i<events.length; i++) {
                    this.storeStateEvent(events[i]);
                }
            },
            storeStateEvent: function(event) {
                if (!event) { return; }
                if (event.state_key) {
                    this.s[event.type + event.state_key] = event;
                }
                else {
                    this.s[event.type] = event;
                }
            },
            // test helper methods
            setRoomName: function(name) {
                this.s["m.room.name"] = {
                    content: {
                        name: name
                    }
                };
            },
            setMember: function(user_id, membership, inviter_user_id) {
                if (!inviter_user_id) {
                    inviter_user_id = user_id;
                }
                this.s["m.room.member" + user_id] = {
                    event: {
                        content: {
                            membership: membership
                        },
                        state_key: user_id,
                        user_id: inviter_user_id 
                    }
                };
                this.members[user_id] = this.s["m.room.member" + user_id];
            }
        };
        testOldState = angular.copy(testNowState);
        
        // mocked dependencies
        module(function ($provide) {
            $provide.value('modelService', modelService);
            $provide.value('matrixService', matrixService);
            $provide.value('notificationService', notificationService);
            $provide.value('mPresence', mPresence);
        });
        
        // tested service
        module('eventHandlerService');
    });
    
    beforeEach(inject(function($rootScope, $q, $timeout) {
        scope = $rootScope;
        q = $q;
        timeout = $timeout;
    }));

    it('should be able to join a room from a room ID.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        var roomId = "!foobar:matrix.org";
        testRoomState = [
            {
                event_id: "a",
                user_id: "@bob:matrix.org",
                state_key: "@bob:matrix.org",
                room_id: roomId,
                content: { membership: "join" },
            },
            {
                event_id: "b",
                user_id: testUserId,
                state_key: testUserId,
                room_id: roomId,
                content: { membership: "join" },
            }
        
        ];
        
        spyOn(matrixService, "join").and.callThrough();
        spyOn(matrixService, "roomInitialSync").and.callThrough();
        var promiseResult = undefined;
        eventHandlerService.joinRoom(roomId).then(function(r) {
            promiseResult = r;
        }, function(err) {
            promiseResult = err;
        });
        scope.$digest(); // resolve stuff
        expect(matrixService.join).toHaveBeenCalledWith(roomId);
        expect(matrixService.roomInitialSync).toHaveBeenCalledWith(roomId);
        expect(promiseResult).toEqual(roomId);
    }));
    
    it('should be able to join a room from a room alias.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        var roomAlias = "#flibble:matrix.org";
        testRoomState = [
            {
                event_id: "a",
                user_id: "@bob:matrix.org",
                state_key: "@bob:matrix.org",
                room_id: testResolvedRoomId,
                content: { membership: "join" },
            },
            {
                event_id: "b",
                user_id: testUserId,
                state_key: testUserId,
                room_id: testResolvedRoomId,
                content: { membership: "join" },
            }
        
        ];
        
        spyOn(matrixService, "resolveRoomAlias").and.callThrough();
        spyOn(matrixService, "roomInitialSync").and.callThrough();
        spyOn(testNowState, "storeStateEvents").and.callThrough();
        var promiseResult = undefined;
        eventHandlerService.joinRoom(roomAlias).then(function(r) {
            promiseResult = r;
        }, function(err) {
            promiseResult = err;
        });
        scope.$digest(); // resolve stuff
        expect(matrixService.resolveRoomAlias).toHaveBeenCalledWith(roomAlias);
        expect(matrixService.roomInitialSync).toHaveBeenCalledWith(testResolvedRoomId);
        expect(testNowState.storeStateEvents).toHaveBeenCalledWith(testRoomState);
        expect(promiseResult).toEqual(testResolvedRoomId);
    }));
    
    it('should NOT join a room that has been joined already.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        var roomId = "!foobar:matrix.org";
        testNowState.setMember(testUserId, "join");
        
        var promiseResult = undefined;
        eventHandlerService.joinRoom(roomId).then(function(r) {
            promiseResult = r;
        }, function(err) {
            promiseResult = err;
        });
        
        spyOn(matrixService, "join");
        scope.$digest(); // resolve stuff
        expect(matrixService.join).not.toHaveBeenCalled();
        expect(promiseResult).toEqual(roomId);
    }));
    
    it('should waitForInitialSyncCompletion.', inject(
    function(eventHandlerService) {
        var promiseResult = undefined;
        eventHandlerService.waitForInitialSyncCompletion().then(function(r) {
            promiseResult = r;
        }, function(err) {
            promiseResult = err;
        });
        expect(promiseResult).toBeUndefined();
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        scope.$digest(); // resolve stuff
        expect(promiseResult).toBeDefined();
    }));
    
    it('eventContainsBingWord should return true if notificationService says so.', inject(
    function(eventHandlerService) {
        // the main test here is to make sure that event handler service is NOT
        // applying any special logic to the bing word check; it should just be
        // channeling the boolean we give it via notificationService. If this
        // test fails, then there is additional logic for bing word checking which
        // should be in notificationService. 
        testContainsBingWords = true;
        expect(eventHandlerService.eventContainsBingWord({
            event_id: "a",
            user_id: "@someone:matrix.org",
            room_id: "!weuidfwe:matrix.org",
            content: {
                body: "foobar"
            }
        })).toBeTruthy();
        
        testContainsBingWords = false;
        expect(eventHandlerService.eventContainsBingWord({
            event_id: "a",
            user_id: "@someone:matrix.org",
            room_id: "!weuidfwe:matrix.org",
            content: {
                body: "foobar"
            }
        })).toBeFalsy();
    }));
    
    it('should be able to handle multiple events.', inject(
    function(eventHandlerService) {
        spyOn(modelService, "setUser");
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        
        var eventA = {
            content: {
                user_id: "@alice:matrix.org",
                presence: "online"
            },
            user_id: "@alice:matrix.org",
            type: "m.presence"
        };
        
        var eventB = {
            content: {
                user_id: "@bob:matrix.org",
                presence: "unavailable"
            },
            user_id: "@bob:matrix.org",
            type: "m.presence"
        };
        
        var eventC = {
            content: {
                user_id: "@claire:matrix.org",
                presence: "online"
            },
            user_id: "@claire:matrix.org",
            type: "m.presence"
        };
        
        eventHandlerService.handleEvents([eventA, eventB, eventC]);
        expect(modelService.setUser).toHaveBeenCalledWith(eventA);
        expect(modelService.setUser).toHaveBeenCalledWith(eventB);
        expect(modelService.setUser).toHaveBeenCalledWith(eventC);
    }));
    
    it('should be able to process m.presence events.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        
        spyOn(modelService, "setUser");
        var event = {
            content: {
                user_id: "@claire:matrix.org",
                presence: "online"
            },
            user_id: "@claire:matrix.org",
            type: "m.presence"
        };
        eventHandlerService.handleEvent(event);
        expect(modelService.setUser).toHaveBeenCalledWith(event);
    }));
    
    it('should be able to process redaction events and remove the redacted event.', inject(
    function(eventHandlerService) {
        var badEventId = "wefiuwehf";
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        
        var event = {
            content: {
                body: "something naughty",
                msgtype: "m.text"
            },
            user_id: "@claire:matrix.org",
            room_id: "!foobar:matrix.org",
            type: "m.room.message",
            event_id: badEventId
        };
        eventHandlerService.handleEvent(event, true);
        expect(testEvents[0]).toEqual(event);
        
        var redaction = {
            content: {},
            user_id: "@bob:matrix.org",
            room_id: "!foobar:matrix.org",
            event_id: "wefuiwehfuiw",
            redacts: badEventId,
            type: "m.room.redaction"
        };
        eventHandlerService.handleEvent(redaction, true);
        expect(testEvents).toEqual([]);
    }));
    
    it('should be able to process generic room state events.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        
        spyOn(testNowState, "storeStateEvent");
        var event = {
            content: {
                something: "for nothing"
            },
            user_id: "@claire:matrix.org",
            room_id: "!foobar:matrix.org",
            state_key: "Rubber_Biscuit",
            type: "org.matrix.test.random",
            event_id: "wefiuwehf"
        };
        eventHandlerService.handleEvent(event, true);
        expect(testNowState.storeStateEvent).toHaveBeenCalledWith(event);
    }));
    
    it('should suppress duplicate event IDs.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        var eventId = "wefiuwehf";
        
        var event = {
            content: {
                body: "hello",
                msgtype: "m.text"
            },
            user_id: "@claire:matrix.org",
            room_id: "!foobar:matrix.org",
            type: "m.room.message",
            event_id: eventId
        };
        
        var dupeEvent = {
            content: {
                body: "goodbye", // should suppress based on event ID
                msgtype: "m.text"
            },
            user_id: "@claire:matrix.org",
            room_id: "!foobar:matrix.org",
            type: "m.room.message",
            event_id: eventId
        };
        eventHandlerService.handleEvent(event, true);
        eventHandlerService.handleEvent(dupeEvent, true);
        expect(testEvents.length).toEqual(1);
        expect(testEvents[0]).toEqual(event);
    }));
    
    // NB: We can only indirectly test this by making sure there is no dupe
    //     suppression after EVENT_ID_LIFETIME_MS.
    it('should reap event IDs after EVENT_ID_LIFETIME_MS.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        var eventId = "wefiuwehf";
        
        var event = {
            content: {
                body: "hello",
                msgtype: "m.text"
            },
            user_id: "@claire:matrix.org",
            room_id: "!foobar:matrix.org",
            type: "m.room.message",
            event_id: eventId
        };
        eventHandlerService.handleEvent(event, true);
        
        var dupeEvent = {
            content: {
                body: "goodbye", // should suppress based on event ID
                msgtype: "m.text"
            },
            user_id: "@claire:matrix.org",
            room_id: "!foobar:matrix.org",
            type: "m.room.message",
            event_id: eventId
        };
        
        // mock date
        var testTime = new Date().getTime() + 
                       eventHandlerService.EVENT_ID_LIFETIME_MS + 1000;
        var oldDate = Date;
        spyOn(window, 'Date').and.callFake(function() {
            return new oldDate(testTime);
        });
        
        timeout.flush(); // force a recheck
        
        // should not suppress since it forgot about it.
        eventHandlerService.handleEvent(dupeEvent, true);
        expect(testEvents.length).toEqual(2);
    }));
    
    /* TODO
    it('should be able to store and process initial sync data.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
    })); */
    
});
