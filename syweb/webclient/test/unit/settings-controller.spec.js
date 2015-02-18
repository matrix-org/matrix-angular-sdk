describe("SettingsController ", function() {
    var rootScope, scope, ctrl, $q, $timeout;
    var userId = "@foo:bar";
    var displayName = "Foo";
    var avatarUrl = "avatar.url";
    
    var dialogService = {
        showError: function(err){}, // will be spyed
        showSuccess: function(a,b){} // will be spyed
    };

    var paymentService = {
        getCredit: function(){
            return $q.defer().promise;
        }
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
        linkEmail: function(){},
        bindEmail: function(){},
        authEmail: function(){}
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
                'dialogService': dialogService,
                'paymentService': paymentService
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
    
    it('should display a text error (no dialog) if failed to load your displayname.', function() {
        var oldFeedback = angular.copy(scope.feedback);
        var nameDefer = $q.defer();
        spyOn(matrixService, "getDisplayName").and.returnValue(nameDefer.promise);
        spyOn(dialogService, "showError");
        
        scope.onInit();
        
        nameDefer.reject({status:0, data:{}});
        scope.$digest();
        
        expect(scope.feedback).not.toEqual(oldFeedback);
        expect(dialogService.showError).not.toHaveBeenCalled();
    });
    
    it('should display a text error (no dialog) if failed to load your avatar url.', function() {
        var oldFeedback = angular.copy(scope.feedback);
        var avatar = "somepic.jpg";
        var picDefer = $q.defer();
        spyOn(matrixService, "getProfilePictureUrl").and.returnValue(picDefer.promise);
        spyOn(dialogService, "showError");
        
        scope.onInit();
        expect(matrixService.getProfilePictureUrl).toHaveBeenCalled();
        
        picDefer.reject({status:0, data:{}});
        scope.$digest();
        
        expect(scope.feedback).not.toEqual(oldFeedback);
        expect(dialogService.showError).not.toHaveBeenCalled();
    });
    
    it('should upload a new avatar when it is changed.', function() {
        var defer = $q.defer();
        spyOn(mFileUpload, "uploadFile").and.returnValue(defer.promise);
    
        scope.profile.avatarFile = "foo.jpg";
        scope.$digest();
        expect(mFileUpload.uploadFile).toHaveBeenCalledWith(scope.profile.avatarFile);
    });
    
    it('should show an error if it fails to upload a new avatar.', function() {
        var defer = $q.defer();
        spyOn(mFileUpload, "uploadFile").and.returnValue(defer.promise);
        spyOn(dialogService, "showError");
        scope.profile.avatarFile = "foo.jpg";
        
        defer.reject({status:0, data:{}});
        scope.$digest();
        
        expect(dialogService.showError).toHaveBeenCalled();
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
    
    it('should be able to link an email address to the account.', function() {
        var linkDefer = $q.defer();
        var authDefer = $q.defer();
        var bindDefer = $q.defer();
        spyOn(matrixService, "linkEmail").and.returnValue(linkDefer.promise);
        spyOn(matrixService, "authEmail").and.returnValue(authDefer.promise);
        spyOn(matrixService, "bindEmail").and.returnValue(bindDefer.promise);
        
        var email = "foo@bar.com";
        expect(scope.linkedEmails.linkedEmailList).toBeUndefined();
        scope.linkEmail(email);
        
        expect(matrixService.linkEmail).toHaveBeenCalledWith(email, jasmine.any(String), jasmine.any(Number));
        var sessionId = "session_id_here";
        linkDefer.resolve({data:{success:true, sid:sessionId}});
        scope.$digest();
        
        scope.linkedEmails.emailCode = "123456";
        scope.submitEmailCode();
        expect(matrixService.authEmail).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(String), "123456");
        authDefer.resolve({data:{}});
        scope.$digest();
        
        expect(matrixService.bindEmail).toHaveBeenCalled();
        bindDefer.resolve({data:{}});
        scope.$digest();
        
        expect(scope.linkedEmails.linkedEmailList[email]).toBeDefined();   
    });
    
    it('should display an error if it fails to bind the email.', function() {
        var oldFeedback = angular.copy(scope.emailFeedback);
        var linkDefer = $q.defer();
        var authDefer = $q.defer();
        var bindDefer = $q.defer();
        spyOn(matrixService, "linkEmail").and.returnValue(linkDefer.promise);
        spyOn(matrixService, "authEmail").and.returnValue(authDefer.promise);
        spyOn(matrixService, "bindEmail").and.returnValue(bindDefer.promise);
        
        var email = "foo@bar.com";
        expect(scope.linkedEmails.linkedEmailList).toBeUndefined();
        scope.linkEmail(email);
        
        expect(matrixService.linkEmail).toHaveBeenCalledWith(email, jasmine.any(String), jasmine.any(Number));
        var sessionId = "session_id_here";
        linkDefer.resolve({data:{success:true, sid:sessionId}});
        scope.$digest();
        
        scope.linkedEmails.emailCode = "123456";
        scope.submitEmailCode();
        expect(matrixService.authEmail).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(String), "123456");
        authDefer.resolve({data:{}});
        scope.$digest();
        
        // rejected here
        expect(matrixService.bindEmail).toHaveBeenCalled();
        bindDefer.reject({status:0, data:{}});
        scope.$digest();
        
        expect(scope.emailFeedback).not.toEqual(oldFeedback);   
    });
    
    it('should display an error if it fails to auth the email.', function() {
        var oldFeedback = angular.copy(scope.emailFeedback);
        var linkDefer = $q.defer();
        var authDefer = $q.defer();
        spyOn(matrixService, "linkEmail").and.returnValue(linkDefer.promise);
        spyOn(matrixService, "authEmail").and.returnValue(authDefer.promise);
        
        var email = "foo@bar.com";
        expect(scope.linkedEmails.linkedEmailList).toBeUndefined();
        scope.linkEmail(email);
        
        expect(matrixService.linkEmail).toHaveBeenCalledWith(email, jasmine.any(String), jasmine.any(Number));
        var sessionId = "session_id_here";
        linkDefer.resolve({data:{success:true, sid:sessionId}});
        scope.$digest();
        
        // rejected here
        scope.linkedEmails.emailCode = "123456";
        scope.submitEmailCode();
        expect(matrixService.authEmail).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(String), "123456");
        authDefer.reject({status:0, data:{}});
        scope.$digest();
        
        expect(scope.emailFeedback).not.toEqual(oldFeedback);   
    });
    
    it('should display an error if it fails to link the email.', function() {
        var oldFeedback = angular.copy(scope.emailFeedback);
        var linkDefer = $q.defer();
        spyOn(matrixService, "linkEmail").and.returnValue(linkDefer.promise);
        
        var email = "foo@bar.com";
        expect(scope.linkedEmails.linkedEmailList).toBeUndefined();
        scope.linkEmail(email);
        
        // rejected here
        expect(matrixService.linkEmail).toHaveBeenCalledWith(email, jasmine.any(String), jasmine.any(Number));
        var sessionId = "session_id_here";
        linkDefer.reject({status:0, data:{}});
        scope.$digest();
        
        expect(scope.emailFeedback).not.toEqual(oldFeedback);   
    });
    
    it('should persist audio notification settings.', function() {
        spyOn(matrixService, "saveConfig");
        spyOn(matrixService, "setConfig");
    
        scope.settings.audioNotifications = true;
        scope.updateAudioNotification();
        
        expect(matrixService.setConfig).toHaveBeenCalledWith(jasmine.objectContaining({
            audioNotifications: true
        }));
        expect(matrixService.saveConfig).toHaveBeenCalled();  
    });
    
    it('should persist bing word settings.', function() {
        var bings = "hi, bye";
        spyOn(matrixService, "saveConfig");
        spyOn(matrixService, "setConfig");
    
        scope.settings.bingWords = bings;
        scope.saveBingWords();
        
        expect(matrixService.setConfig).toHaveBeenCalledWith(jasmine.objectContaining({
            bingWords: bings
        }));
        expect(matrixService.saveConfig).toHaveBeenCalled();  
    });
});
