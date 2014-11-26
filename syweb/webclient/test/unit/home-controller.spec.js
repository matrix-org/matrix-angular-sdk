describe("HomeController ", function() {
    var rootScope, scope, ctrl, $q, $timeout;
    var userId = "@foo:bar";
    var displayName = "Foo";
    var avatarUrl = "avatar.url";
    
    var dialogService = {
        showError: function(err){}, // will be spyed
        showSuccess: function(a,b){} // will be spyed
    };
    
    // test vars
    var testDisplayName, testProfilePicture;
    
    
    // mock services
    var matrixService = {
        config: function() {
            return {
                user_id: userId
            }
        },
        setConfig: function(){},
        saveConfig: function(){},
        getDisplayName: function(userId) {
            var d = $q.defer();
            d.resolve({
                data: testDisplayName
            });
            return d.promise;
        },
        getProfilePictureUrl: function(userId){
            var d = $q.defer();
            d.resolve({
                data: testProfilePicture
            });
            return d.promise;
        },
        setDisplayName: function(name){},
        setProfilePictureUrl: function(url){},
        publicRooms: function(){}
    };
    
    var eventHandlerService = {
        joinRoom: function(a){},
        createRoom: function(alias, isPublic){},
        ROOM_CREATE_EVENT: "ROOM_CREATE_EVENT",
        RESET_EVENT: "RESET_EVENT"
    };
    var recentsService = {
        setSelectedRoomId: function(roomId){}
    };
    var modal = {};
    var location = {
        url: function(path){}
    }
    
    beforeEach(function() {
        module('HomeController');
        
        // reset test vars
        testDisplayName = "Me";
        testProfilePicture = "http://example.com/face.jpg";
    });

    beforeEach(inject(function($rootScope, $injector, $controller, _$q_, _$timeout_) {
            $q = _$q_;
            $timeout = _$timeout_;
            scope = $rootScope.$new();
            rootScope = $rootScope;
            ctrl = $controller('HomeController', {
                '$scope': scope,
                'matrixService': matrixService,
                'eventHandlerService': eventHandlerService,
                'dialogService': dialogService,
                'recentsService': recentsService,
                '$modal': modal,
                '$location': location
            });
        })
    );

    it('should be able to join a room.', function() {
        var roomId = "!spleef:matrix.org";
        var roomAlias = "#matrix:matrix.org";
        spyOn(eventHandlerService, "joinRoom").and.callFake(function(room) {
            var d = $q.defer();
            d.resolve(roomId);
            return d.promise;
        });
        spyOn(location, "url");
        
        scope.joinAlias(roomAlias);
        scope.$digest();
        
        expect(eventHandlerService.joinRoom).toHaveBeenCalledWith(roomAlias);
        expect(location.url).toHaveBeenCalledWith("/room/#matrix:matrix.org");
    });
    
    it('should be able to message a user directly.', function() {
        var roomId = "!spleeeeeef:matrix.org";
        spyOn(location, "url");
        spyOn(eventHandlerService, "createRoom").and.callFake(function() {
            var d = $q.defer();
            d.resolve(roomId);
            return d.promise;
        });
        
        scope.newChat.user = "@bob:matrix.org";
        scope.messageUser();
        scope.$digest();
        
        expect(eventHandlerService.createRoom).toHaveBeenCalledWith(null, 
                "private", ["@bob:matrix.org"]);
        expect(location.url).toHaveBeenCalledWith("/room/"+roomId);
    });
    
    it("should get the public room list, user's display name and avatar url after initialisation.", function() {
        var publicRooms = [ { room_id: "!a:b" }, { room_id: "!c:d" } ];
        spyOn(matrixService, "getDisplayName").and.callFake(function() {
            var d = $q.defer();
            d.resolve({data:{displayname:displayName}});
            return d.promise;
        });
        spyOn(matrixService, "getProfilePictureUrl").and.callFake(function() {
            var d = $q.defer();
            d.resolve({data:{avatar_url:avatarUrl}});
            return d.promise;
        });
        spyOn(matrixService, "publicRooms").and.callFake(function() {
            var d = $q.defer();
            d.resolve({data:{chunk:publicRooms}});
            return d.promise;
        });
    
        scope.onInit();
        scope.$digest();
    
        expect(matrixService.getDisplayName).toHaveBeenCalled();
        expect(matrixService.getProfilePictureUrl).toHaveBeenCalled();
        expect(matrixService.publicRooms).toHaveBeenCalled();
        
        expect(scope.public_rooms).toEqual(publicRooms);
        expect(scope.profile.displayName).toEqual(displayName);
        expect(scope.profile.avatarUrl).toEqual(avatarUrl);
    });
});
describe("CreateRoomController ", function() {
    var rootScope, scope, ctrl, $q, $timeout;
    var userId = "@foo:bar";
    var displayName = "Foo";
    var avatarUrl = "avatar.url";
    
    var dialogService = {
        showError: function(err){}, // will be spyed
        showSuccess: function(a,b){} // will be spyed
    };
    
    // test vars
    var testDisplayName, testProfilePicture;

    var eventHandlerService = {
        joinRoom: function(a){},
        createRoom: function(alias, isPublic){},
        ROOM_CREATE_EVENT: "ROOM_CREATE_EVENT",
        RESET_EVENT: "RESET_EVENT"
    };
    var modalInstance = {};
    
    beforeEach(function() {
        module('HomeController');
        
        // reset test vars
        testDisplayName = "Me";
        testProfilePicture = "http://example.com/face.jpg";
    });

    beforeEach(inject(function($rootScope, $injector, $controller, _$q_, 
                               _$timeout_) {
            $q = _$q_;
            $timeout = _$timeout_;
            scope = $rootScope.$new();
            rootScope = $rootScope;
            ctrl = $controller('CreateRoomController', {
                '$scope': scope,
                'eventHandlerService': eventHandlerService,
                'dialogService': dialogService,
                '$modalInstance': modalInstance
            });
        })
    );
    
    it('should be able to create a public room with no alias.', function() {
        var roomId = "!aaa:matrix.org";
        spyOn(eventHandlerService, "createRoom").and.callFake(function() {
            var d = $q.defer();
            d.resolve(roomId);
            return d.promise;
        });
        scope.newRoom.isPublic = true;
        scope.create();
        expect(eventHandlerService.createRoom).toHaveBeenCalledWith(undefined, 
                "public");
    });
    
    it('should be able to create a public room with an alias.', function() {
        var roomId = "!aaa:matrix.org";
        var alias = "hello";
        spyOn(eventHandlerService, "createRoom").and.callFake(function() {
            var d = $q.defer();
            d.resolve(roomId);
            return d.promise;
        });
        scope.newRoom.isPublic = true;
        scope.newRoom.alias = alias;
        scope.create();
        expect(eventHandlerService.createRoom).toHaveBeenCalledWith(alias, 
                "public");
    });
    
    it('should be able to create a private room with no alias.', function() {
        var roomId = "!aaa:matrix.org";
        spyOn(eventHandlerService, "createRoom").and.callFake(function() {
            var d = $q.defer();
            d.resolve(roomId);
            return d.promise;
        });
        scope.newRoom.isPublic = false;
        scope.create();
        expect(eventHandlerService.createRoom).toHaveBeenCalledWith(undefined, 
                "private");
    });
    
    it('should be able to create a private room with an alias.', function() {
        var roomId = "!aaa:matrix.org";
        var alias = "hello";
        spyOn(eventHandlerService, "createRoom").and.callFake(function() {
            var d = $q.defer();
            d.resolve(roomId);
            return d.promise;
        });
        scope.newRoom.isPublic = false;
        scope.newRoom.alias = alias;
        scope.create();
        expect(eventHandlerService.createRoom).toHaveBeenCalledWith(alias, 
                "private");
    });
});
