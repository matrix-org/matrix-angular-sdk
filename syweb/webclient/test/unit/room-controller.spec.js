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
        setTopic: function(rm,topic){}
    };
    
    var eventHandlerService = {
        joinRoom: function(rm){},
        handleRoomMessages: function(room, data, live, dir){},
        sendMessage: function(rm,input){}
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
    
    beforeEach(function() {
        module('matrixWebClient');
        
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
                '$routeParams': routeParams
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
});
