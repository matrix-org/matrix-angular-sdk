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
    var mFileUpload = {};
    
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
});
