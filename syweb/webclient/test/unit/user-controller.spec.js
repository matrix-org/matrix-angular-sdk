describe("UserController", function() {
    var scope, ctrl, matrixService, routeParams, $q;
    var userId = "@foo:bar";
    var targetUserId = "@target:bar";
    
    var dialogService = {
        showError: function(){},
        showProgress: function(){}
    };
    
    var matrixService = {
        config: function(){},
        getDisplayName: function(){},
        getProfilePictureUrl: function(){}
    };
    
    var eventHandlerService = {
        createRoom: function(){}
    };
    
    
    beforeEach(function() {
        module('UserController');
    });

    beforeEach(inject(function($rootScope, $injector, $controller, _$q_) {
            spyOn(matrixService, "config").and.returnValue({user_id:userId});
            
            $q = _$q_;
            scope = $rootScope.$new();
            rootScope = $rootScope;
            rootScope.goToPage = function(){};
            routeParams = {
                user_matrix_id: targetUserId
            };
            ctrl = $controller('UserController', {
                '$scope': scope,
                '$rootScope': rootScope,
                '$routeParams': routeParams,
                'matrixService': matrixService,
                'dialogService': dialogService,
                'eventHandlerService': eventHandlerService
            });
        })
    );

    it('should be able to message a user', function() {
        // setup
        spyOn(matrixService, "getDisplayName").and.returnValue($q.defer().promise);
        spyOn(matrixService, "getProfilePictureUrl").and.returnValue($q.defer().promise);
        scope.onInit();
    
        var roomId = "!weoufhweu:matrix.org";
        var createDefer = $q.defer();
        spyOn(eventHandlerService, "createRoom").and.returnValue(createDefer.promise);
        spyOn(rootScope, "goToPage");
    
        scope.messageUser();
        
        expect(eventHandlerService.createRoom).toHaveBeenCalledWith(undefined, "private", [targetUserId]);
        createDefer.resolve(roomId);
        scope.$digest();
        expect(rootScope.goToPage).toHaveBeenCalledWith("/room/"+roomId);
    });
    
    it('should display an error if it cannot message a user', function() {
        // setup
        spyOn(matrixService, "getDisplayName").and.returnValue($q.defer().promise);
        spyOn(matrixService, "getProfilePictureUrl").and.returnValue($q.defer().promise);
        scope.onInit();
    
        var roomId = "!weoufhweu:matrix.org";
        var createDefer = $q.defer();
        spyOn(eventHandlerService, "createRoom").and.returnValue(createDefer.promise);
        spyOn(dialogService, "showError");
    
        scope.messageUser();
        
        expect(eventHandlerService.createRoom).toHaveBeenCalled();
        createDefer.reject("Oh noes");
        scope.$digest();
        expect(dialogService.showError).toHaveBeenCalled();
    });
    
    it("should request the target user's display name", function() {
        var nameDefer = $q.defer();
        spyOn(matrixService, "getDisplayName").and.returnValue(nameDefer.promise);
        spyOn(matrixService, "getProfilePictureUrl").and.returnValue($q.defer().promise);
        scope.onInit();
        
        var name = "Some Name";
        expect(matrixService.getDisplayName).toHaveBeenCalledWith(targetUserId);
        nameDefer.resolve({data:{displayname: name}});
        scope.$digest();
        expect(scope.user.displayname).toEqual(name);
    });
    
    it("should request the target user's avatar URL", function() {
        var picDefer = $q.defer();
        spyOn(matrixService, "getDisplayName").and.returnValue($q.defer().promise);
        spyOn(matrixService, "getProfilePictureUrl").and.returnValue(picDefer.promise);
        scope.onInit();
        
        var pic = "http://somepic.com/pic.jpg";
        expect(matrixService.getProfilePictureUrl).toHaveBeenCalledWith(targetUserId);
        picDefer.resolve({data:{avatar_url:pic}});
        scope.$digest();
        expect(scope.user.avatar_url).toEqual(pic);
    });
});
