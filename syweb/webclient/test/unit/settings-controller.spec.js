describe("SettingsController ", function() {
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
        setProfilePictureUrl: function(url){}
    };
    
    var eventStreamService = {};
    var mFileUpload = {
        uploadFile: function(){}
    };
    
    beforeEach(function() {
        module('matrixWebClient');
        
        // reset test vars
        testDisplayName = "Me";
        testProfilePicture = "http://example.com/face.jpg";
    });

    beforeEach(inject(function($rootScope, $injector, $controller, _$q_, _$timeout_) {
            $q = _$q_;
            $timeout = _$timeout_;
            scope = $rootScope.$new();
            rootScope = $rootScope;
            ctrl = $controller('SettingsController', {
                '$scope': scope,
                'matrixService': matrixService,
                'mFileUpload': mFileUpload,
                'dialogService': dialogService
            });
        })
    );

    // SYWEB-157
    it('should give feedback after updating your display name.', function() {
        spyOn(dialogService, "showSuccess");
        spyOn(matrixService, "setDisplayName").and.callFake(function(name) {
            var d = $q.defer();
            d.resolve({data: {}});
            return d.promise;
        });
        
        expect(dialogService.showSuccess).not.toHaveBeenCalled();
        scope.profile.displayName = "Foo";
        scope.saveProfile(); 
        rootScope.$digest();
        
        expect(matrixService.setDisplayName).toHaveBeenCalledWith(scope.profile.displayName);
        expect(dialogService.showSuccess).toHaveBeenCalled();
    });
    
    // SYWEB-157
    it('should give feedback after updating your avatar url.', function() {
        spyOn(dialogService, "showSuccess");
        spyOn(matrixService, "setProfilePictureUrl").and.callFake(function(name) {
            var d = $q.defer();
            d.resolve({data: {}});
            return d.promise;
        });
        
        expect(dialogService.showSuccess).not.toHaveBeenCalled();
        scope.profile.avatarUrl = "http://example.com/face2.jpg";
        scope.saveProfile(); 
        rootScope.$digest();
        
        expect(matrixService.setProfilePictureUrl).toHaveBeenCalledWith(scope.profile.avatarUrl);
        expect(dialogService.showSuccess).toHaveBeenCalled();
    });
    
    it('should get your avatar url and displayname when loaded.', function() {
        var name = "Bob";
        var avatar = "somepic.jpg";
        var nameDefer = $q.defer();
        var picDefer = $q.defer();
        spyOn(matrixService, "getDisplayName").and.returnValue(nameDefer.promise);
        spyOn(matrixService, "getProfilePictureUrl").and.returnValue(picDefer.promise);
        
        scope.onInit();
        expect(matrixService.getDisplayName).toHaveBeenCalled();
        expect(matrixService.getProfilePictureUrl).toHaveBeenCalled();
        
        nameDefer.resolve({data:{displayname:name}});
        picDefer.resolve({data:{avatar_url:avatar}});
        scope.$digest();
        
        expect(scope.profile.displayName).toEqual(name);
        expect(scope.profile.avatarUrl).toEqual(avatar);
        expect(scope.profileOnServer.displayName).toEqual(name);
        expect(scope.profileOnServer.avatarUrl).toEqual(avatar);
    });
    
    it('should upload a new avatar when it is changed.', function() {
        var defer = $q.defer();
        spyOn(mFileUpload, "uploadFile").and.returnValue(defer.promise);
    
        scope.profile.avatarFile = "foo.jpg";
        scope.$digest();
        expect(mFileUpload.uploadFile).toHaveBeenCalledWith(scope.profile.avatarFile);
    });
    
    it('should upload diffs when saving profile info.', function() {
        var name = "Bob";
        var avatar = "somepic.jpg";
        var nameDefer = $q.defer();
        var picDefer = $q.defer();
        var setPicDefer = $q.defer();
        var setNameDefer = $q.defer();
        nameDefer.resolve({data:{displayname:name}});
        picDefer.resolve({data:{avatar_url:avatar}});
        spyOn(matrixService, "getDisplayName").and.returnValue(nameDefer.promise);
        spyOn(matrixService, "getProfilePictureUrl").and.returnValue(picDefer.promise);
        spyOn(matrixService, "setDisplayName").and.returnValue(setPicDefer.promise);
        spyOn(matrixService, "setProfilePictureUrl").and.returnValue(setNameDefer.promise);
        
        
        scope.onInit();
        scope.$digest();
        
        // no diffs
        scope.saveProfile();
        expect(matrixService.setDisplayName).not.toHaveBeenCalled();
        expect(matrixService.setProfilePictureUrl).not.toHaveBeenCalled();
        
        // make a diff
        scope.profile.avatarUrl = "some_other_pic.jpg";
        scope.saveProfile();
        expect(matrixService.setDisplayName).not.toHaveBeenCalled();
        expect(matrixService.setProfilePictureUrl).toHaveBeenCalledWith(scope.profile.avatarUrl);
        
        // make 2 diffs
        scope.profile.displayName = "Bobette";
        scope.profile.avatarUrl = "some_other_pic22.jpg";
        scope.saveProfile();
        expect(matrixService.setDisplayName).toHaveBeenCalledWith(scope.profile.displayName);
        expect(matrixService.setProfilePictureUrl).toHaveBeenCalledWith(scope.profile.avatarUrl);
    });
    
    it('should display an error if it fails to set the display name.', function() {
        spyOn(dialogService, "showError");
        spyOn(matrixService, "setDisplayName").and.callFake(function(name) {
            var d = $q.defer();
            d.reject("oopsie");
            return d.promise;
        });
        
        expect(dialogService.showError).not.toHaveBeenCalled();
        scope.profile.displayName = "Mike";
        scope.saveProfile(); 
        rootScope.$digest();
        
        expect(matrixService.setDisplayName).toHaveBeenCalledWith(scope.profile.displayName);
        expect(dialogService.showError).toHaveBeenCalled();
    });
    
    it('should display an error if it fails to set the avatar url.', function() {
        spyOn(dialogService, "showError");
        spyOn(matrixService, "setProfilePictureUrl").and.callFake(function(name) {
            var d = $q.defer();
            d.reject("oopsie");
            return d.promise;
        });
        
        expect(dialogService.showError).not.toHaveBeenCalled();
        scope.profile.avatarUrl = "http://example.com/face2.jpg";
        scope.saveProfile(); 
        rootScope.$digest();
        
        expect(matrixService.setProfilePictureUrl).toHaveBeenCalledWith(scope.profile.avatarUrl);
        expect(dialogService.showError).toHaveBeenCalled();
    });
});
