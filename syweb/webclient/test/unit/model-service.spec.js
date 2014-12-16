describe('ModelService', function() {
    var rootScope, q;

    var matrixService = {
        leave: function(){}
    };

    // setup the dependencies
    beforeEach(function() {
        // dependencies
        module(function ($provide) {
            $provide.value('matrixService', matrixService);
        });
        
        // tested service
        module('modelService');
    });
    
    beforeEach(inject(function($q, $rootScope) {
        rootScope = $rootScope;
        q = $q;
    }));
    
    it('should be able to add message events', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        
        var room = modelService.getRoom(roomId);
        
        var event = {
            content: {
                body: "herro",
                msgtype: "m.text"
            },
            user_id: userId,
            type: "m.room.message",
            event_id: "aoufhai"
        };
        
        room.addMessageEvent(event);
        
        expect(room.aevents.length).toEqual(1);
        expect(room.aevents[0].event).toEqual(jasmine.objectContaining(event));
        
        // add 2 more events
        event = angular.copy(event);
        event.content.body = "goodbye";
        event.event_id = "wefuohweui";
        var events = [ event ];
        
        event = angular.copy(event);
        event.content.body = "333";
        event.event_id = "wefuohfswaaaweui";
        events.push(event);
        room.addMessageEvents(events);
        
        expect(room.aevents.length).toEqual(3);
        expect(room.aevents[0].event.content.body).toEqual("herro");
        expect(room.aevents[1].event.content.body).toEqual("goodbye");
        expect(room.aevents[2].event.content.body).toEqual("333");
    }));
    
    it('should add old messages to the start and new messages to the front.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        
        var room = modelService.getRoom(roomId);
        
        var event = {
            content: {
                body: "herro",
                msgtype: "m.text"
            },
            user_id: userId,
            type: "m.room.message",
            event_id: "aoufhai"
        };
        room.addMessageEvent(event, false); // to end
        
        // add 2 more events
        event = angular.copy(event);
        event.content.body = "goodbye";
        event.event_id = "wefuohweui";
        room.addMessageEvent(event, true); // to start
        
        event = angular.copy(event);
        event.content.body = "333";
        event.event_id = "wefuohfswaaaweui";
        room.addMessageEvent(event, true); // to start
        
        expect(room.aevents.length).toEqual(3);
        expect(room.aevents[2].event.content.body).toEqual("herro");
        expect(room.aevents[1].event.content.body).toEqual("goodbye");
        expect(room.aevents[0].event.content.body).toEqual("333");
    }));
    
    it('should $broadcast live message events.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        var room = modelService.getRoom(roomId);
        var event = {
            content: {
                body: "herro",
                msgtype: "m.text"
            },
            user_id: userId,
            type: "m.room.message",
            event_id: "aoufhai"
        };
        
        var bcast;
        rootScope.$on(modelService.LIVE_MESSAGE_EVENT, function(ngEvent, event) {
            bcast = event;
        });
        
        room.addMessageEvent(event);
        rootScope.$digest();
        
        expect(bcast.event).toEqual(event);
    }));
    
    it('should NOT $broadcast old message events.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        var room = modelService.getRoom(roomId);
        var event = {
            content: {
                body: "herro",
                msgtype: "m.text"
            },
            user_id: userId,
            type: "m.room.message",
            event_id: "aoufhai"
        };
        
        var bcast;
        rootScope.$on(modelService.LIVE_MESSAGE_EVENT, function(ngEvent, event) {
            bcast = event;
        });
        
        room.addMessageEvent(event, true);
        rootScope.$digest();
        
        expect(bcast).toBeUndefined();
    }));
    
    it('should be able to Room.getAnnotatedEvent.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        var room = modelService.getRoom(roomId);
        var event = {
            content: {
                body: "herro",
                msgtype: "m.text"
            },
            user_id: userId,
            type: "m.room.message",
            event_id: "aoufhai"
        };
        room.addMessageEvent(event);
        var e = room.getAnnotatedEvent("aoufhai");
        
        expect(e.event).toEqual(event);
    }));
    
    it('should be able to Room.removeEvent.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        var room = modelService.getRoom(roomId);
        var event = {
            content: {
                body: "herro",
                msgtype: "m.text"
            },
            user_id: userId,
            type: "m.room.message",
            event_id: "aoufhai"
        };
        room.addMessageEvent(event);
        room.removeEvent(event);
        
        expect(room.aevents.length).toEqual(0);
    }));

    it('should be able to get a member in a room', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        
        modelService.getRoom(roomId).current_room_state.storeStateEvent({
            type: "m.room.member",
            id: "fwefw:matrix.org",
            user_id: userId,
            state_key: userId,
            content: {
                membership: "join"
            }
        });
        
        var user = modelService.getMember(roomId, userId);
        expect(user.event.state_key).toEqual(userId);
    }));
    
    it('should be able to get a users power level', inject(
    function(modelService) {
        var roomId = "!foo:matrix.org";
        
        var room = modelService.getRoom(roomId);
        room.current_room_state.storeStateEvent({
            content: { membership: "join" },
            user_id: "@adam:matrix.org",
            state_key: "@adam:matrix.org",
            type: "m.room.member"
        });
        room.current_room_state.storeStateEvent({
            content: { membership: "join" },
            user_id: "@beth:matrix.org",
            state_key: "@beth:matrix.org",
            type: "m.room.member"
        });
        room.current_room_state.storeStateEvent({
            content: {
                users: {
                    "@adam:matrix.org": 90
                },
                "users_default": 50
            },
            user_id: "@adam:matrix.org",
            type: "m.room.power_levels"
        });
        
        var num = modelService.getUserPowerLevel(roomId, "@beth:matrix.org");
        expect(num).toEqual(50);
        
        num = modelService.getUserPowerLevel(roomId, "@adam:matrix.org");
        expect(num).toEqual(90);
        
        num = modelService.getUserPowerLevel(roomId, "@unknown:matrix.org");
        expect(num).toEqual(50);
    }));
    
    it('should be able to get a user', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        
        var presenceEvent = {
            content: {
                user_id: userId,
                displayname: "Bob",
                last_active_ago: 1415981891580
            },
            type: "m.presence",
            event_id: "weofhwe@matrix.org"
        };
        
        modelService.setUser(presenceEvent);
        var user = modelService.getUser(userId);
        expect(user.event).toEqual(presenceEvent);
    }));
    
    it('should be able to create and get alias mappings.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var alias = "#foobar:matrix.org";
        
        modelService.createRoomIdToAliasMapping(roomId, alias);
        
        expect(modelService.getRoomIdToAliasMapping(roomId)).toEqual(alias);
        expect(modelService.getAliasToRoomIdMapping(alias)).toEqual(roomId);
        
    }));
    
    it('should clobber alias mappings.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var alias = "#foobar:matrix.org";
        var newAlias = "#foobarNEW:matrix.org";
        
        modelService.createRoomIdToAliasMapping(roomId, alias);
        
        expect(modelService.getRoomIdToAliasMapping(roomId)).toEqual(alias);
        expect(modelService.getAliasToRoomIdMapping(alias)).toEqual(roomId);
        
        modelService.createRoomIdToAliasMapping(roomId, newAlias);
        
        expect(modelService.getRoomIdToAliasMapping(roomId)).toEqual(newAlias);
        expect(modelService.getAliasToRoomIdMapping(newAlias)).toEqual(roomId);
        
    }));
    
    it('should update RoomMember when User is updated to point to the latest info.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        
        var presenceEvent = {
            content: {
                user_id: userId,
                displayname: "Bob",
                last_active_ago: 1415
            },
            type: "m.presence",
            event_id: "weofhwe@matrix.org"
        };
        
        var newPresenceEvent = {
            content: {
                user_id: userId,
                displayname: "The only and only Bob",
                last_active_ago: 1900
            },
            type: "m.presence",
            event_id: "weofhtweterte@matrix.org"
        };
        
        modelService.setUser(presenceEvent);
        
        modelService.getRoom(roomId).current_room_state.storeStateEvent({
            type: "m.room.member",
            id: "fwefw:matrix.org",
            user_id: userId,
            state_key: userId,
            content: {
                membership: "join"
            }
        });
        
        var roomMember = modelService.getMember(roomId, userId);
        expect(roomMember.user.event).toEqual(presenceEvent);
        expect(roomMember.user.event.content.displayname).toEqual("Bob");
        
        modelService.setUser(newPresenceEvent);
        
        expect(roomMember.user.event.content.displayname).toEqual("The only and only Bob");
        
    }));
    
    it('should normalise power levels between 0-100.', inject(
    function(modelService) {
        var roomId = "!foo:matrix.org";
        
        var room = modelService.getRoom(roomId);
        room.current_room_state.storeStateEvent({
            content: { membership: "join" },
            user_id: "@adam:matrix.org",
            state_key: "@adam:matrix.org",
            type: "m.room.member"
        });
        room.current_room_state.storeStateEvent({
            content: { membership: "join" },
            user_id: "@beth:matrix.org",
            state_key: "@beth:matrix.org",
            type: "m.room.member"
        });
        room.current_room_state.storeStateEvent({
            content: {
                users: {
                    "@adam:matrix.org": 1000
                },
                "users_default": 500
            },
            user_id: "@adam:matrix.org",
            type: "m.room.power_levels"
        });
        
        var roomMember = modelService.getMember(roomId, "@beth:matrix.org");
        expect(roomMember.power_level).toEqual(500);
        expect(roomMember.power_level_norm).toEqual(50);

        
    }));
    
    it('should be able to get the number of joined users in a room', inject(
    function(modelService) {
        var roomId = "!foo:matrix.org";
        // set mocked data
        var room = modelService.getRoom(roomId);
        room.current_room_state.storeStateEvent({
            content: { membership: "join" },
            user_id: "@adam:matrix.org",
            state_key: "@adam:matrix.org",
            type: "m.room.member"
        });
        room.current_room_state.storeStateEvent({
            content: { membership: "invite" },
            user_id: "@adam:matrix.org",
            state_key: "@beth:matrix.org",
            type: "m.room.member"
        });
        room.current_room_state.storeStateEvent({
            content: { membership: "join" },
            user_id: "@charlie:matrix.org",
            state_key: "@charlie:matrix.org",
            type: "m.room.member"
        });
        room.current_room_state.storeStateEvent({
            content: { membership: "leave" },
            user_id: "@danice:matrix.org",
            state_key: "@danice:matrix.org",
            type: "m.room.member"
        });
        
        var num = modelService.getUserCountInRoom(roomId);
        expect(num).toEqual(2);
    }));
    
    it('should update existing room members with their latest power level. (m.room.member THEN m.room.power_levels)', inject(
    function(modelService) {
        var roomId = "!foo:matrix.org";
        
        var room = modelService.getRoom(roomId);
        room.current_room_state.storeStateEvent({
            content: { membership: "join" },
            user_id: "@adam:matrix.org",
            state_key: "@adam:matrix.org",
            type: "m.room.member"
        });
        room.current_room_state.storeStateEvent({
            content: {
                users: {
                    "@adam:matrix.org": 70
                },
                "users_default": 50
            },
            user_id: "@adam:matrix.org",
            type: "m.room.power_levels"
        });
        
        var roomMember = modelService.getMember(roomId, "@adam:matrix.org");
        expect(roomMember.power_level).toEqual(70);
        expect(roomMember.power_level_norm).toEqual(100);
    }));
    
    it('should update new room members with their latest power level. (m.room.power_levels THEN m.room.member)', inject(
    function(modelService) {
        var roomId = "!foo:matrix.org";
        
        var room = modelService.getRoom(roomId);
        room.current_room_state.storeStateEvent({
            content: {
                users: {
                    "@adam:matrix.org": 70
                },
                "users_default": 50
            },
            user_id: "@adam:matrix.org",
            type: "m.room.power_levels"
        });
        room.current_room_state.storeStateEvent({
            content: { membership: "join" },
            user_id: "@adam:matrix.org",
            state_key: "@adam:matrix.org",
            type: "m.room.member"
        });
        var roomMember = modelService.getMember(roomId, "@adam:matrix.org");
        expect(roomMember.power_level).toEqual(70);
        expect(roomMember.power_level_norm).toEqual(100);
    }));
    
    it('should set event.sender when a live message is added.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        
        modelService.getRoom(roomId).current_room_state.storeStateEvent({
            type: "m.room.member",
            id: "fwefw:matrix.org",
            user_id: userId,
            state_key: userId,
            room_id: roomId,
            content: {
                membership: "join"
            }
        });
        
        var event = {
            content: {
                body: "Hello",
                msgtype: "m.text"
            },
            user_id: userId,
            room_id: roomId,
            type: "m.room.message"
        };
        
        var msgEvent = modelService.getRoom(roomId).addMessageEvent(event, false);
        expect(msgEvent.sender).toBeDefined();
    }));
    
    it('should set event.sender when a live message clobbers a local echoed message.', inject(
    function(modelService) {
        var roomId = "!wefiohwefuiow:matrix.org";
        var userId = "@bob:matrix.org";
        
        modelService.getRoom(roomId).current_room_state.storeStateEvent({
            type: "m.room.member",
            id: "fwefw:matrix.org",
            user_id: userId,
            state_key: userId,
            room_id: roomId,
            content: {
                membership: "join"
            }
        });
        
        var echoEvent = {
            content: {
                body: "Hello",
                msgtype: "m.text"
            },
            user_id: userId,
            room_id: roomId,
            type: "m.room.message"
        };
        modelService.getRoom(roomId).addMessageEvent(echoEvent, false);
        
        var event = {
            content: {
                body: "Hello",
                msgtype: "m.text"
            },
            user_id: userId,
            room_id: roomId,
            type: "m.room.message"
        };
        
        var msgEvent = modelService.getRoom(roomId).addOrReplaceMessageEvent(event, false);
        expect(msgEvent.sender).toBeDefined();
    }));
    
    it('should be able to Room.leave()', inject(function(modelService) {
        var leaveDefer = q.defer();
        spyOn(matrixService, "leave").and.returnValue(leaveDefer.promise);
        var room = modelService.getRoom("!foo:bar");
        var response;
        room.leave().then(function(res) {
            response = res;
        });
        expect(matrixService.leave).toHaveBeenCalledWith("!foo:bar");
        leaveDefer.resolve({data:{}});
        rootScope.$digest();
        expect(response).toBeDefined();
    }));
    
    it('should be able to remove a room', inject(function(modelService) {
        var room = modelService.getRoom("!foo:bar");
        expect(Object.keys(modelService.getRooms()).length).toEqual(1);
        modelService.removeRoom("!foo:bar");
        expect(Object.keys(modelService.getRooms()).length).toEqual(0);
    }));
    
    it('should be able to clear all rooms', inject(function(modelService) {
        var room = modelService.getRoom("!foo:bar");
        room = modelService.getRoom("!baz:bar");
        expect(Object.keys(modelService.getRooms()).length).toEqual(2);
        modelService.clearRooms();
        expect(Object.keys(modelService.getRooms()).length).toEqual(0);
    }));
});
