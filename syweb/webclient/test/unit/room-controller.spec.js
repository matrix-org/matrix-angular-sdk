describe("RoomController ", function() {
    var rootScope, scope, ctrl, $q, $timeout, routeParams;
    var userId = "@foo:bar";
    var displayName = "Foo";
    var avatarUrl = "avatar.url";
    var roomId = "!ygsffwe:matrix.org";
    
    var dialogService = {
        showError: function(err){}, // will be spyed
        showSuccess: function(a,b){} // will be spyed
    };
    
    // test vars
    var testRoom, testPaginationChunk;
    
    
    // mock services
    var matrixService = {
        config: function() {
            return {
                user_id: userId
            }
        },
        paginateBackMessages: function(roomId, token, num){
            return resolve(testPaginationChunk, true);
        },
        setName: function(rm,name){},
        setTopic: function(rm,topic){},
        redactEvent: function(roomId, eventId){}
    };
    
    var eventHandlerService = {
        joinRoom: function(rm){},
        handleRoomMessages: function(room, data, live, dir){},
        sendMessage: function(rm,input){},
        resendMessage: function(event, cb){}
    };
    var mFileUpload = {};
    var mUserDisplayNameFilter = function(roomId){ return "";};
    var modelService = {
        getRoom: function(roomId) {
            return testRoom;
        }
    };
    var recentsService = {
        setSelectedRoomId: function(roomId){}
    };
    var commandsService = {
        processInput: function(roomId, input){}
    };
    var MatrixCall = {};
    var modal = {
        open: function(){}
    };
    var typingService = {
        setTyping: function(){}
    };
    
    beforeEach(function() {
        module('RoomController');
        
        // reset test vars
        testRoom = {
            room_id: roomId,
            old_room_state: {},
            current_room_state: {
                state_events: {}
            },
            events: []
        };
        
        testPaginationChunk = {
            chunk: [],
            start: "s",
            end: "e"
        };
    });
    
    // helper methods
    var resolve = function(output, isHttp) {
        var d = $q.defer();
        if (isHttp) {
            d.resolve({ data: output });
        }
        else {
            d.resolve(output);
        }
        return d.promise;
    };
    
    var reject = function(output, isHttp) {
        var d = $q.defer();
        if (isHttp) {
            d.reject({ data: output });
        }
        else {
            d.reject(output);
        }
        return d.promise;
    };

    beforeEach(inject(function($rootScope, $injector, $controller, _$q_, _$timeout_) {
            $q = _$q_;
            $timeout = _$timeout_;
            scope = $rootScope.$new();
            rootScope = $rootScope;
            routeParams = {
            
            };
            ctrl = $controller('RoomController', {
                '$scope': scope,
                '$rootScope': $rootScope,
                'matrixService': matrixService,
                'mUserDisplayNameFilter': mUserDisplayNameFilter,
                'eventHandlerService': eventHandlerService,
                'modelService': modelService,
                'recentsService': recentsService,
                'commandsService': commandsService,
                'MatrixCall': MatrixCall,
                'mFileUpload': mFileUpload,
                'dialogService': dialogService,
                '$routeParams': routeParams,
                '$modal': modal,
                'typingService': typingService
            });
        })
    );

    it('should load a room alias in the url when initialised.', function() {
        var roomAlias = "#roomalias:matrix.org";
        routeParams.room_id_or_alias = encodeURIComponent(roomAlias);
        
        spyOn(eventHandlerService, "joinRoom").and.callFake(function(room) {
            return resolve("!roomid:matrix.org");
        });
        
        scope.onInit(); 
        rootScope.$digest();
        expect(eventHandlerService.joinRoom).toHaveBeenCalledWith(roomAlias);
        
    });
    
    it('should load a room ID in the url when initialised.', function() {
        var id = "!sdofh:matrix.org";
        routeParams.room_id_or_alias = encodeURIComponent(id);
        
        spyOn(eventHandlerService, "joinRoom").and.callFake(function(room) {
            return resolve(id);
        });
        
        scope.onInit(); 
        rootScope.$digest();
        expect(eventHandlerService.joinRoom).toHaveBeenCalledWith(id);
        
    });
    
    it('should be able to send a message.', function() {
        // setup
        var id = "!sdofh:matrix.org";
        var input = "Hello world";
        routeParams.room_id_or_alias = encodeURIComponent(id);
        spyOn(eventHandlerService, "joinRoom").and.returnValue(resolve(id));
        scope.onInit(); 
        rootScope.$digest();
        
        
        spyOn($.fn, "val").and.returnValue(input);
        spyOn(eventHandlerService, "sendMessage");
        scope.send();
        expect(eventHandlerService.sendMessage).toHaveBeenCalledWith(id, input, jasmine.any(Object));
    });
    
    it('should show an error if it failed to send a message.', function() {
        // setup
        var id = "!sdofh:matrix.org";
        var input = "Hello world";
        routeParams.room_id_or_alias = encodeURIComponent(id);
        spyOn(eventHandlerService, "joinRoom").and.returnValue(resolve(id));
        scope.onInit(); 
        rootScope.$digest();
        
        spyOn($.fn, "val").and.returnValue(input);
        spyOn(eventHandlerService, "sendMessage");
        scope.send();
        
        var error = "Oh no";
        spyOn(dialogService, "showError");
        var callback = eventHandlerService.sendMessage.calls.argsFor(0)[2];
        callback.onError(error);
        expect(dialogService.showError).toHaveBeenCalledWith(error);
    });
    
    it('should be able to edit the room name.', function() {
        var roomId = "!wefweui:matrix.org";
        var roomName = "Room Name";
        var newRoomName = "New Room Name";
        scope.room_id = roomId;
        scope.room = testRoom;
        testRoom.current_room_state.state_events["m.room.name"] = {
            content: {
                name: roomName
            },
            user_id: "@a:b",
            room_id: roomId,
            type: "m.room.name",
            event_id: "a"
        };
        
        expect(scope.name.isEditing).toBe(false);
        scope.name.editName(); //e.g. double click
        expect(scope.name.isEditing).toBe(true);
        expect(scope.name.newNameText).toEqual(roomName); // pre-fill current name
        scope.name.newNameText = newRoomName; // simulate user input
        spyOn(matrixService, "setName").and.returnValue(resolve({}));
        scope.name.updateName();
        expect(matrixService.setName).toHaveBeenCalledWith(roomId, newRoomName);
    });
    
    it('should be able to edit the room topic.', function() {
        var roomId = "!wefweui:matrix.org";
        var roomTopic = "Room Topic";
        var newRoomTopic = "New Room Topic";
        scope.room_id = roomId;
        scope.room = testRoom;
        testRoom.current_room_state.state_events["m.room.topic"] = {
            content: {
                topic: roomTopic
            },
            user_id: "@a:b",
            room_id: roomId,
            type: "m.room.topic",
            event_id: "a"
        };
        
        expect(scope.topic.isEditing).toBe(false);
        scope.topic.editTopic(); //e.g. double click
        expect(scope.topic.isEditing).toBe(true);
        expect(scope.topic.newTopicText).toEqual(roomTopic); // pre-fill current topic
        scope.topic.newTopicText = newRoomTopic; // simulate user input
        spyOn(matrixService, "setTopic").and.returnValue(resolve({}));
        scope.topic.updateTopic();
        expect(matrixService.setTopic).toHaveBeenCalledWith(roomId, newRoomTopic);
    });
    
    it('should lock the room when banned.', function() {
        var roomId = "!wefweui:matrix.org";
        scope.room_id = roomId;
        scope.room = testRoom;
        
        expect(scope.state.permission_denied).toBeUndefined();
        
        scope.$broadcast(eventHandlerService.MEMBER_EVENT, {
            content: {
                membership: "ban"
            },
            state_key: userId,
            user_id: "@a:b",
            room_id: roomId,
            event_id: "a",
            type: "m.room.member"
        }, true);
        
        expect(scope.state.permission_denied).toBeDefined();
    });
    
    it('should lock the room when they leave.', function() {
        var roomId = "!wefweui:matrix.org";
        scope.room_id = roomId;
        scope.room = testRoom;
        
        expect(scope.state.permission_denied).toBeUndefined();
        
        scope.$broadcast(eventHandlerService.MEMBER_EVENT, {
            content: {
                membership: "leave"
            },
            state_key: userId,
            user_id: userId,
            room_id: roomId,
            event_id: "a",
            type: "m.room.member"
        }, true);
        
        expect(scope.state.permission_denied).toBeDefined();
    });
    
    it('should lock the room when they are kicked.', function() {
        var roomId = "!wefweui:matrix.org";
        scope.room_id = roomId;
        scope.room = testRoom;
        
        expect(scope.state.permission_denied).toBeUndefined();
        
        scope.$broadcast(eventHandlerService.MEMBER_EVENT, {
            content: {
                membership: "leave"
            },
            state_key: userId,
            user_id: "@a:b",
            room_id: roomId,
            event_id: "a",
            type: "m.room.member"
        }, true);
        
        expect(scope.state.permission_denied).toBeDefined();
    });
    
    it('should be able to open the event info dialog.', function() {
        var roomId = "!wefweui:matrix.org";
        scope.room_id = roomId;
        scope.room = testRoom;
        
        var annotatedEvent = {
            event: {
                content: {
                    body: "something naughty",
                    msgtype: "m.text"
                },
                user_id: userId,
                type: "m.room.message",
                event_id: "aa"
            }
        };
        
        var defer = $q.defer();
        spyOn(modal, "open").and.callFake(function() {
            return {
                result: defer.promise
            };
        });
        expect(scope.event_selected).toBeUndefined();
        scope.openJson(annotatedEvent);
        expect(modal.open).toHaveBeenCalled();
        expect(scope.event_selected).toEqual(jasmine.objectContaining(annotatedEvent));
    });
    
    it('should be able to redact an event on the event info dialog.', function() {
        var roomId = "!wefweui:matrix.org";
        var eventId = "aaa";
        scope.room_id = roomId;
        scope.room = testRoom;
        
        var msgEvent = {
            event: {
                content: {
                    body: "something naughty",
                    msgtype: "m.text"
                },
                user_id: userId,
                type: "m.room.message",
                room_id: roomId,
                event_id: eventId
            }
        };
        
        // open the dialog
        var defer = $q.defer();
        spyOn(modal, "open").and.returnValue({result: defer.promise});
        scope.openJson(msgEvent);
        
        
        // hit the redact button
        var redactDefer = $q.defer();
        spyOn(matrixService, "redactEvent").and.returnValue(redactDefer.promise);
        defer.resolve("redact");
        scope.$digest();
        expect(matrixService.redactEvent).toHaveBeenCalledWith(roomId, eventId);  
    });
    
    it('should be able to resend an event on the event info dialog.', function() {
        var roomId = "!wefweui:matrix.org";
        var eventId = "aaa";
        scope.room_id = roomId;
        scope.room = testRoom;
        
        var annotatedEvent = {
            event: {
                content: {
                    body: "something naughty",
                    msgtype: "m.text"
                },
                user_id: userId,
                type: "m.room.message",
                room_id: roomId,
                event_id: eventId
            },
            send_state: "unsent"
        };
        
        // open the dialog
        var defer = $q.defer();
        spyOn(modal, "open").and.callFake(function() {
            return {
                result: defer.promise
            };
        });
        scope.openJson(annotatedEvent);
        
        
        // hit the resend button
        var resendDefer = $q.defer();
        spyOn(eventHandlerService, "resendMessage").and.callFake(function() {
            return resendDefer.promise;
        });
        defer.resolve("resend");
        scope.$digest();
        expect(eventHandlerService.resendMessage).toHaveBeenCalledWith(
            annotatedEvent, 
            jasmine.any(Object)
        );  
    });
    
    it('should be able to open the room info dialog.', function() {
        var roomId = "!wefweui:matrix.org";
        var eventId = "aaa";
        scope.room_id = roomId;
        scope.room = testRoom;
        
        // open the dialog
        var defer = $q.defer();
        spyOn(modal, "open").and.callFake(function() {
            return {
                result: defer.promise
            };
        });
        scope.openRoomInfo();
        expect(modal.open).toHaveBeenCalled();
    });
});
describe("RoomInfoController ", function() {
    var rootScope, scope, location, ctrl, $q;
    
    var roomId = "!foo:bar.com";
    
    var matrixService = {
        invite: function(){},
        sendStateEvent: function(){}
    };
    
    var eventHandlerService = {
        leaveRoom: function(){}
    };
    
    var dialogService = {
        showSuccess: jasmine.createSpy("dialogService.showSuccess"),
        showError: jasmine.createSpy("dialogService.showError")
    };
    
    var modalInstance = {
        dismiss: jasmine.createSpy("modalInstance.dismiss")
    };
    
    var location = {
        url: jasmine.createSpy("location.url")
    };
    
    beforeEach(module("RoomController"));
    
    beforeEach(inject(function($rootScope, $injector, $controller, _$q_) {
            $q = _$q_;
            scope = $rootScope.$new();
            scope.room_id = roomId;
            rootScope = $rootScope;
            routeParams = {
            
            };
            ctrl = $controller('RoomInfoController', {
                '$scope': scope,
                '$location': location,
                'matrixService': matrixService,
                'eventHandlerService': eventHandlerService,
                'dialogService': dialogService,
                '$modalInstance': modalInstance
            });
        })
    );
    
    it('should be able to invite a user.', function() {
        var invitee = "@invitee:matrix.org";
        var inviteDefer = $q.defer();
        spyOn(matrixService, "invite").and.returnValue(inviteDefer.promise);
        
        scope.userIDToInvite = invitee;
        scope.inviteUser();
        
        expect(matrixService.invite).toHaveBeenCalledWith(roomId, invitee);
        inviteDefer.resolve({data:{}});
        scope.$digest();
        
        expect(dialogService.showSuccess).toHaveBeenCalled();
    });
    
    it('should display an error if it cannot invite a user.', function() {
        var invitee = "@invitee:matrix.org";
        var inviteDefer = $q.defer();
        spyOn(matrixService, "invite").and.returnValue(inviteDefer.promise);
        
        scope.userIDToInvite = invitee;
        scope.inviteUser();
        
        expect(matrixService.invite).toHaveBeenCalledWith(roomId, invitee);
        inviteDefer.reject({status:0, data:{}});
        scope.$digest();
        
        expect(dialogService.showError).toHaveBeenCalled();
    });
    
    it('should be able to submit a new event.', function() {
        var event = {
            content: {
                foo: "bar"
            },
            state_key: "bar",
            type: "m.foo",
        };
        var eventDefer = $q.defer();
        spyOn(matrixService, "sendStateEvent").and.returnValue(eventDefer.promise);
        
        scope.submit(event);
        
        expect(matrixService.sendStateEvent).toHaveBeenCalledWith(roomId, event.type, event.content, event.state_key);
        eventDefer.resolve({data:{event_id:"foooo"}});
        scope.$digest();
        
        expect(modalInstance.dismiss).toHaveBeenCalled();
    });
    
    it('should display an error if it is unable to submit a new event.', function() {
        var event = {
            content: {
                foo: "bar"
            },
            state_key: "bar",
            type: "m.foo",
        };
        var eventDefer = $q.defer();
        spyOn(matrixService, "sendStateEvent").and.returnValue(eventDefer.promise);
        
        scope.submit(event);
        
        expect(matrixService.sendStateEvent).toHaveBeenCalledWith(roomId, event.type, event.content, event.state_key);
        eventDefer.reject({status: 403, data:{}});
        scope.$digest();
        
        expect(dialogService.showError).toHaveBeenCalled();
    });
    
    it('should be able to leave a room.', function() {
        var leaveDefer = $q.defer();
        spyOn(eventHandlerService, "leaveRoom").and.returnValue(leaveDefer.promise);
        
        scope.leaveRoom();
        
        expect(eventHandlerService.leaveRoom).toHaveBeenCalledWith(roomId);
        leaveDefer.resolve({data:{}});
        scope.$digest();
        expect(modalInstance.dismiss).toHaveBeenCalled();
        expect(location.url).toHaveBeenCalled();
    });
    
    it('should display an error if it cannot leave a room.', function() {
        var leaveDefer = $q.defer();
        spyOn(eventHandlerService, "leaveRoom").and.returnValue(leaveDefer.promise);
        
        scope.leaveRoom();
        
        expect(eventHandlerService.leaveRoom).toHaveBeenCalledWith(roomId);
        leaveDefer.reject({status:0, data:{}});
        scope.$digest();
        
        expect(dialogService.showError).toHaveBeenCalled();
    });
});
describe("EventInfoController ", function() {
    var rootScope, scope, ctrl, $q;

    var modalInstance = {
        close: jasmine.createSpy("modalInstance.dismiss")
    };
    
    beforeEach(module("RoomController"));
    
    beforeEach(inject(function($rootScope, $injector, $controller, _$q_) {
        var testEvent = {
            content: {
                foo: "bar"
            },
            type: "m.foobar"
        };
    
        $q = _$q_;
        scope = $rootScope.$new();
        scope.event_selected = testEvent;
        rootScope = $rootScope;
        ctrl = $controller('EventInfoController', {
            '$scope': scope,
            '$modalInstance': modalInstance
        });
    }));
    
    it('should return "redact" if the redact button was hit.', function() {
        scope.redact();
        expect(modalInstance.close).toHaveBeenCalledWith("redact");
    });
    
    it('should return "resend" if the resend button was hit.', function() {
        scope.resend();
        expect(modalInstance.close).toHaveBeenCalledWith("resend");
    });
});
