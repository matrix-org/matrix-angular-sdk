describe('EventHandlerService', function() {
    var scope, q;
    
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
        roomState: function(roomId) {
            var defer = q.defer();
            if (testRoomState) {
                defer.resolve({ data: testRoomState });
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
    
    beforeEach(inject(function($rootScope, $q) {
        scope = $rootScope;
        q = $q;
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
        spyOn(matrixService, "roomState").and.callThrough();
        var promiseResult = undefined;
        eventHandlerService.joinRoom(roomId).then(function(r) {
            promiseResult = r;
        }, function(err) {
            promiseResult = err;
        });
        scope.$digest(); // resolve stuff
        expect(matrixService.join).toHaveBeenCalledWith(roomId);
        expect(matrixService.roomState).toHaveBeenCalledWith(roomId);
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
        spyOn(matrixService, "roomState").and.callThrough();
        spyOn(testNowState, "storeStateEvents").and.callThrough();
        var promiseResult = undefined;
        eventHandlerService.joinRoom(roomAlias).then(function(r) {
            promiseResult = r;
        }, function(err) {
            promiseResult = err;
        });
        scope.$digest(); // resolve stuff
        expect(matrixService.resolveRoomAlias).toHaveBeenCalledWith(roomAlias);
        expect(matrixService.roomState).toHaveBeenCalledWith(testResolvedRoomId);
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
    
});
