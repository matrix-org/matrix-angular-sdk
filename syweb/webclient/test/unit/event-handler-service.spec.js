describe('EventHandlerService', function() {
    var scope, q, timeout, _window;
    
    var testContainsBingWords, testPresenceState, testRoomName; // mPresence, mRoomNameFilter, notificationService
    var testUserId, testDisplayName, testBingWords; // matrixService.config
    var testResolvedRoomId, testJoinSuccess, testRoomInitialSync; // matrixService
    var testNowState, testOldState, testEvents; // modelService
    
    var modelService = {
        getRoom: function(roomId) {
            return {
                room_id: roomId,
                current_room_state: testNowState,
                now: testNowState,
                old_room_state: testOldState,
                aevents: testEvents,
                addMessageEvent: function(event, toFront) {
                    if (toFront) {
                        testEvents.unshift({event: event});
                    }
                    else {
                        testEvents.push({event: event});
                    }
                },
                addOrReplaceMessageEvent: function(event, toFront) {
                    for (var i = this.aevents.length - 1; i >= 0; i--) {
                        var storedEvent = this.aevents[i].event;
                        if (storedEvent.event_id === event.event_id) {
                            this.aevents[i] = {event: event};
                            return;
                        }
                    }
                    this.addMessageEvent(event, toFront);
                },
                getAnnotatedEvent: function(eventId) {
                    for (var i = this.aevents.length - 1; i >= 0; i--) {
                        var storedEvent = this.aevents[i];
                        if (storedEvent.event.event_id === eventId) {
                            return storedEvent;
                        }
                    }
                },
                removeEvent: function(event) {
                    for (var i=0; i<this.aevents.length; i++) {
                        if (this.aevents[i].event == event) {
                            this.aevents.splice(i, 1);
                            break;
                        }
                    }
                },
                mutateRoomMemberState: function(){}
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
            if (testRoomInitialSync) {
                defer.resolve({ data: testRoomInitialSync });
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
        sendTextMessage: function(roomId, input) {
            var defer = q.defer();
            if (testSendMessage) {
                defer.resolve({ data: testSendMessage });
            }
            else {
                defer.reject({ data: { error: "some testSendMessage error", errcode: "M_UNKNOWN" } });
            }
            return defer.promise;
        },
        create: function(){},
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
    
    var commandsService = {
        processInput: function(roomId, input) {}
    };
    
    var mRoomNameFilter = function(){
        return function() {
            return testRoomName;
        }
    };
    
    var mUserDisplayNameFilter = function() {
        return function(input) {
            return input;
        }
    };
    
    // helper function
    var mkEvent = function(evType, content, rmId, stateKey, usrId) {
        var eventId = Math.random().toString(36);
        if (!usrId) {
            usrId = testUserId;
        }
        return {
            event_id: eventId,
            user_id: usrId,
            state_key: stateKey,
            room_id: rmId,
            content: content,
            type: evType
        };
    };
    

    // setup the service and mocked dependencies
    beforeEach(function() {
        // reset test vars
        testContainsBingWords = false;
        testPresenceState = matrixService.presence.unavailable;
        
        testUserId = "@me:matrix.org";
        testDisplayName = "Me";
        testBingWords = [];
        
        testRoomName = "Room Name";
        testJoinSuccess = true;
        testResolvedRoomId = "!foo:matrix.org";
        testRoomInitialSync = {
            state: [],
            messages: {
                chunk: [],
                start: "s",
                end: "e"
            },
            presence: []
        };
        testEvents = [];
        testSendMessage = {
            event_id: "foobar"
        };
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
            $provide.value('commandsService', commandsService);
            $provide.factory('mRoomNameFilter', mRoomNameFilter);
            $provide.factory('mUserDisplayNameFilter', mUserDisplayNameFilter);
        });
        
        // tested service
        module('eventHandlerService');
    });
    
    beforeEach(inject(function($rootScope, $q, $timeout, $window) {
        scope = $rootScope;
        q = $q;
        timeout = $timeout;
        _window = $window;
    }));

    it('joinRoom: should be able to join a room from a room ID.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        var roomId = "!foobar:matrix.org";
        testRoomInitialSync.state = [
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
        expect(matrixService.roomInitialSync).toHaveBeenCalledWith(roomId, jasmine.any(Number));
        expect(promiseResult).toEqual(roomId);
    }));
    
    it('joinRoom: should be able to join a room from a room alias.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        var roomAlias = "#flibble:matrix.org";
        testRoomInitialSync.state = [
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
        expect(matrixService.roomInitialSync).toHaveBeenCalledWith(testResolvedRoomId, jasmine.any(Number));
        expect(testNowState.storeStateEvents).toHaveBeenCalledWith(testRoomInitialSync.state);
        expect(promiseResult).toEqual(testResolvedRoomId);
    }));
    
    // SYWEB-181
    it('should inject events into a room when joining if there are some.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        var roomId = "!foobar:matrix.org";
        testRoomInitialSync.state = [
            {
                event_id: "a",
                user_id: "@bob:matrix.org",
                state_key: "@bob:matrix.org",
                room_id: roomId,
                content: { membership: "join" },
                type: "m.room.member"
            },
            {
                event_id: "b",
                user_id: testUserId,
                state_key: testUserId,
                room_id: roomId,
                content: { membership: "join" },
                type: "m.room.member"
            }
        
        ];
        testRoomInitialSync.messages.chunk = [
            {
                event_id: "c",
                user_id: "@bob:matrix.org",
                room_id: roomId,
                content: { 
                    msgtype: "m.text",
                    body: "Hello1"
                },
                type: "m.room.message"
            },
            {
                event_id: "d",
                user_id: "@bob:matrix.org",
                room_id: roomId,
                content: { 
                    msgtype: "m.text",
                    body: "Hello2"
                },
                type: "m.room.message"
            }
        ];
        
        var promiseResult = undefined;
        eventHandlerService.joinRoom(roomId).then(function(r) {
            promiseResult = r;
        }, function(err) {
            promiseResult = err;
        });
        scope.$digest(); // resolve stuff
        
        for (var i=0; i<testEvents.length; i++) {
            expect(testEvents[i].event).toEqual(testRoomInitialSync.messages.chunk[i]);
        }
        
        expect(promiseResult).toEqual(roomId);
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
        expect(testEvents[0].event).toEqual(event);
        
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
    
    it('should suppress duplicate event IDs received from /events.', inject(
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
        expect(testEvents[0].event).toEqual(event);
    }));
    
    it('should suppress duplicate event IDs when sending messages.', inject(
    function(eventHandlerService) {
        var roomId = "!flibble:matrix.org";
        var sendCallback = {
            onSendEcho: function(echo){},
            onSent: function(response, isEcho){},
            onError: function(error){}
        };
        spyOn(sendCallback, "onSendEcho");
        spyOn(sendCallback, "onSent");
        spyOn(sendCallback, "onError");
        
        
        var eventId = "someEventId";
        testSendMessage = {
            event_id: eventId
        };
        
        eventHandlerService.sendMessage(roomId, "some text", sendCallback);
        expect(sendCallback.onSendEcho).toHaveBeenCalled();
        expect(testEvents.length).toEqual(1);
        
        // oh noes, the message comes down the event stream before this request finishes
        var event = {
            content: {
                body: "some text",
                msgtype: "m.text"
            },
            user_id: testUserId,
            room_id: roomId,
            type: "m.room.message",
            event_id: eventId
        };
        eventHandlerService.handleEvent(event, true);
        
        scope.$digest(); // process the send message request
        
        expect(testEvents.length).toEqual(1);
        expect(testEvents[0].event).toEqual(event);
    }));
    
    it('should be able to send a text message with echo.', inject(
    function(eventHandlerService) {
        var roomId = "!flibble:matrix.org";
        var sendCallback = {
            onSendEcho: function(echo){},
            onSent: function(response, isEcho){},
            onError: function(error){}
        };
        spyOn(sendCallback, "onSendEcho");
        spyOn(sendCallback, "onSent");
        spyOn(sendCallback, "onError");
        
        var eventId = "someEventId";
        testSendMessage = {
            event_id: eventId
        };
        
        eventHandlerService.sendMessage(roomId, "some text", sendCallback);
        
        expect(sendCallback.onSendEcho).toHaveBeenCalled();
        scope.$digest(); // process the matrix request
        expect(sendCallback.onSent).toHaveBeenCalledWith({ data: testSendMessage}, true);
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
    
    it('should display a notification for incoming invites.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        
        var event = {
            content: {
                membership: "invite"
            },
            user_id: "@someone:matrix.org",
            room_id: "!foobar:matrix.org",
            state_key: testUserId,
            type: "m.room.member",
            event_id: "wf"
        };
        spyOn(notificationService, "showNotification");
        _window.Notification = true;
        eventHandlerService.handleEvent(event, true);
        expect(notificationService.showNotification).toHaveBeenCalled();
    }));
    
    
    it('should be able to create a room and do an initial sync on the room.', inject(
    function(eventHandlerService) {
        var alias = "bob";
        var isPublic = true;
        var invitee = "@alicia:matrix.org";
        var roomId = "!avauyga:matrix.org";
        var defer = q.defer();
        spyOn(matrixService, "create").and.returnValue(defer.promise);
        spyOn(matrixService, "roomInitialSync").and.callThrough();
        
        var promise = eventHandlerService.createRoom(alias, isPublic, invitee);
        
        expect(matrixService.create).toHaveBeenCalled();
        defer.resolve({data:{room_id:roomId}});
        scope.$digest();
        expect(matrixService.roomInitialSync).toHaveBeenCalledWith(
            roomId, 
            jasmine.any(Number)
        );
    })); 
    
    it('should be able to handle global initial sync data', inject(
    function(eventHandlerService) {
        // a joined room with messages
        var roomId = "!rooma:matrix.org";
        var theRoom = {
            current_room_state: {
                storeStateEvents: function(){}
            },
            old_room_state: {
                storeStateEvents: function(){}
            },
            room_id: roomId,
            addMessageEvent: function(){},
            addOrReplaceMessageEvent: function(){},
            mutateRoomMemberState: function(){}
        };
        testInitialSync.data.rooms.push(angular.copy(testRoomInitialSync));
        
        var roomAmember = "@roomamember:matrix.org";
        testInitialSync.data.rooms[0].state = [
            mkEvent("m.room.member", {membership:"join"}, roomId, testUserId),
            mkEvent("m.room.member", {membership:"join"}, roomId, roomAmember, roomAmember)
        ];
        testInitialSync.data.rooms[0].messages.chunk = [
            mkEvent("m.room.member", {membership:"join"}, roomId, testUserId),
            mkEvent("m.room.member", {membership:"join"}, roomId, roomAmember, roomAmember),
            mkEvent("m.room.message", {body:"hi",msgtype:"m.text"}, roomId),
            mkEvent("m.room.message", {body:"bye",msgtype:"m.text"}, roomId, undefined, roomAmember)
        ];
        testInitialSync.data.rooms[0].room_id = roomId;
        spyOn(modelService, "getRoom").and.returnValue(theRoom);
        spyOn(theRoom.current_room_state, "storeStateEvents");
        spyOn(theRoom.old_room_state, "storeStateEvents");
        spyOn(theRoom, "addOrReplaceMessageEvent");
        spyOn(theRoom, "addMessageEvent");
        
        // an invited room
        var inviterUserId = "@inviter:matrix.org";
        var inviteRoomId = "!invite:matrix.org";
        testInitialSync.data.rooms.push({
            inviter: inviterUserId,
            room_id: inviteRoomId,
            membership: "invite"
        });
        
        // some presence
        testInitialSync.data.presence.push({
            content: {status:"online"},
            user_id: roomAmember,
            type: "m.presence"
        });
        spyOn(modelService, "setUser");
    
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        
        // expect injected fake invite event
        expect(testInitialSync.data.rooms[1].state.length).toEqual(1);
        
        // expect presence stuff
        expect(modelService.setUser).toHaveBeenCalledWith(
            testInitialSync.data.presence[0]
        );
        
        // expect room state & msgs stored
        expect(theRoom.current_room_state.storeStateEvents).toHaveBeenCalledWith(
            testInitialSync.data.rooms[0].state
        );
        // addOrReplace since it was sent by us and we may need to replace local echo
        expect(theRoom.addOrReplaceMessageEvent).toHaveBeenCalledWith(
            testInitialSync.data.rooms[0].messages.chunk[2],
            true
        );
        // add since it wasn't sent by us and so doesn't need to replace a local echo
        expect(theRoom.addMessageEvent).toHaveBeenCalledWith(
            testInitialSync.data.rooms[0].messages.chunk[3],
            true
        );
    }));
    
    it('should be able to process m.typing events.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        testNowState.members = {
            "@aaa:matrix.org": {
                typing: false
            },
            "@bbb:matrix.org": {
                typing: false
            }
        };
        
        var event = {
            content: {
                user_ids: ["@aaa:matrix.org"]
            },
            user_id: "matrix.org",
            type: "m.typing"
        };
        eventHandlerService.handleEvent(event, true);
        expect(testNowState.members["@aaa:matrix.org"].typing).toBe(true);
    }));
    
    it('should clobber m.typing events.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        testNowState.members = {
            "@aaa:matrix.org": {
                typing: false
            },
            "@bbb:matrix.org": {
                typing: false
            }
        };
        
        var event = {
            content: {
                user_ids: ["@aaa:matrix.org"]
            },
            user_id: "matrix.org",
            type: "m.typing"
        };
        eventHandlerService.handleEvent(event, true);
        expect(testNowState.members["@aaa:matrix.org"].typing).toBe(true);
        
        // clobber with bbb
        event = {
            content: {
                user_ids: ["@bbb:matrix.org"]
            },
            user_id: "matrix.org",
            type: "m.typing"
        };
        eventHandlerService.handleEvent(event, true);
        expect(testNowState.members["@aaa:matrix.org"].typing).toBe(false); // reset
        expect(testNowState.members["@bbb:matrix.org"].typing).toBe(true);
    }));
    
    it('should treat an empty m.typing user_ids array as no-one is typing.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        testNowState.members = {
            "@aaa:matrix.org": {
                typing: false
            },
            "@bbb:matrix.org": {
                typing: false
            }
        };
        
        var event = {
            content: {
                user_ids: []
            },
            user_id: "matrix.org",
            type: "m.typing"
        };
        eventHandlerService.handleEvent(event, true);
        expect(testNowState.members["@aaa:matrix.org"].typing).toBe(false);
        expect(testNowState.members["@bbb:matrix.org"].typing).toBe(false);
    }));
    
    it('should ignore unknown user_ids in m.typing.', inject(
    function(eventHandlerService) {
        eventHandlerService.handleInitialSyncDone(testInitialSync);
        testNowState.members = {
            "@aaa:matrix.org": {
                typing: false
            },
            "@bbb:matrix.org": {
                typing: false
            }
        };
        
        var event = {
            content: {
                user_ids: ["@ccc:matrix.org"]
            },
            user_id: "matrix.org",
            type: "m.typing"
        };
        eventHandlerService.handleEvent(event, true);
        expect(testNowState.members["@aaa:matrix.org"].typing).toBe(false);
        expect(testNowState.members["@bbb:matrix.org"].typing).toBe(false);
        expect(testNowState.members["@ccc:matrix.org"]).toBeUndefined();
    }));
    
});
