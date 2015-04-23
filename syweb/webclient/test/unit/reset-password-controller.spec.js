describe("ResetPasswordController ", function() {
    var rootScope, scope, ctrl, $q, $timeout;
    var testSid;
    
    // mock services
    var matrixService = {
        config: function() {
            return {
                user_id: userId
            }
        },
        setConfig: function(){},
        saveConfig: function(){},
        linkEmail: function(){
            var d = $q.defer();
            d.resolve({
                data: {sid: testSid}
            });
            return d.promise;
        },
        setPassword: function(newPassword, authDict) {
            var d = $q.defer();
            d.resolve({
                data: {}
            });
            return d.promise;
        }
    };

    var eventStreamService = {
        resume: function(){}
    };

    var dialogService = {
        showError: function(err){}
    };

    beforeEach(function() {
        module('ResetPasswordController');
    });

    beforeEach(inject(function($rootScope, $injector, $location, $controller, _$q_, _$timeout_) {
        $q = _$q_;
        $timeout = _$timeout_;
        scope = $rootScope.$new();
        rootScope = $rootScope;
        ctrl = $controller('ResetPasswordController', {
            '$scope': scope,
            '$rootScope': $rootScope, 
            '$location': $location,
            'matrixService': matrixService,
            'eventStreamService': eventStreamService,
            'dialogService': dialogService
        });
    }));

    it('should be able to trigger password reset via email auth.', function() {
        var prevFeedback = angular.copy(scope.feedback);
        spyOn(matrixService, "saveConfig");
        spyOn(matrixService, "linkEmail").and.callThrough();
        spyOn(matrixService, "setPassword").and.callThrough();

        testSid = 'thetestsid';
    
        scope.account.pwd1 = "password";
        scope.account.pwd2 = "password";
        scope.account.email = "me@example.com";
        scope.account.desired_user_id = "bob";
        scope.account.homeserver = "http://example.com";
        scope.account.identityServer = "http://example.com";
        scope.reset_password();
        rootScope.$digest();

        expect(matrixService.linkEmail).toHaveBeenCalledWith("me@example.com", scope.clientSecret, 1);

        scope.verifyToken();
        
        expect(matrixService.setPassword).toHaveBeenCalledWith("password", {
            type: 'm.login.email.identity',
            threepidCreds: jasmine.objectContaining({
                sid: 'thetestsid',
                idServer: 'example.com'
            })
        });
    });
});
