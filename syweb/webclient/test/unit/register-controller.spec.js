describe("RegisterController ", function() {
    var rootScope, scope, ctrl, $q, $timeout;
    var userId = "@foo:bar";
    var displayName = "Foo";
    var avatarUrl = "avatar.url";
    
    window.webClientConfig = {
        useCaptcha: false
    };
    
    var dialogService = {
        showError: function(err){} // will be spyed
    };
    
    // test vars
    var testRegisterData, testFailRegisterData;
    var testEmailLinkData, testFailEmailLinkData;
    var testEmailAuthData, testFailEmailAuthData
    
    
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
            if (testFailEmailLinkData) {
                d.reject({
                    data: testFailEmailLinkData
                });
            }
            else {
                d.resolve({
                    data: testEmailLinkData
                });
            }
            return d.promise;
        },
        authEmail: function() {
            var d = $q.defer();
            if (testFailEmailAuthData) {
                d.reject({
                    data: testFailEmailAuthData
                });
            }
            else {
                d.resolve({
                    data: testEmailAuthData
                });
            }
            return d.promise;
        },
        register: function(mxid, password, threepidCreds, captchaResponse, sessionId, bind_email) {
            var d = $q.defer();
            if (threepidCreds === true) d.reject({data: {}});
            if (testFailRegisterData) {
                d.reject({
                    data: testFailRegisterData
                });
            }
            else {
                d.resolve({
                    data: testRegisterData
                });
            }
            return d.promise;
        }
    };
    
    var eventStreamService = {
        resume: function(){}
    };
    
    beforeEach(function() {
        module('matrixWebClient');
        
        // reset test vars
        testRegisterData = undefined;
        testFailRegisterData = undefined;
    });

    beforeEach(inject(function($rootScope, $injector, $location, $controller, _$q_, _$timeout_) {
            $q = _$q_;
            $timeout = _$timeout_;
            scope = $rootScope.$new();
            rootScope = $rootScope;
            rootScope.onLoggedIn = function(){};
            routeParams = {
                user_matrix_id: userId
            };
            ctrl = $controller('RegisterController', {
                '$scope': scope,
                '$rootScope': $rootScope, 
                '$location': $location,
                'matrixService': matrixService,
                'eventStreamService': eventStreamService,
                'dialogService': dialogService
            });
        })
    );

    // SYWEB-109
    it('should display an error if the HS rejects the username on registration', function() {
        var prevFeedback = angular.copy(scope.feedback);
        spyOn(dialogService, "showError");
    
        testFailRegisterData = {
            errcode: "M_UNKNOWN",
            error: "I am rejecting you."
        };
    
        scope.account.pwd1 = "password";
        scope.account.pwd2 = "password";
        scope.account.desired_user_id = "bob";
        scope.register(); // this depends on the result of a deferred
        rootScope.$digest(); // which is delivered after the digest
        
        expect(dialogService.showError).toHaveBeenCalled();
    });

    it('should be able to register with just a user ID and password and save the response.', function() {
        var prevFeedback = angular.copy(scope.feedback);
        spyOn(matrixService, "register").and.callThrough();
        spyOn(matrixService, "saveConfig");
    
        testRegisterData = {
            user_id: "@bob:localhost",
            access_token: "abc123"
        };
    
        scope.account.pwd1 = "password";
        scope.account.pwd2 = "password";
        scope.account.desired_user_id = "bob";
        scope.register(); // this depends on the result of a deferred
        rootScope.$digest(); // which is delivered after the digest
        
        expect(matrixService.register).toHaveBeenCalledWith("bob", "password", undefined, undefined, undefined, true);
        expect(matrixService.saveConfig).toHaveBeenCalled();
    });
    
    it('should be able to register with an email and a user ID and password and save the response.', function() {
        var prevFeedback = angular.copy(scope.feedback);
        spyOn(matrixService, "register").and.callThrough();
        spyOn(matrixService, "authEmail").and.callThrough();
        spyOn(matrixService, "linkEmail").and.callThrough();
        spyOn(matrixService, "saveConfig");

        testEmailLinkData = {
            sid: "session_id"
        };
        
        testEmailAuthData = {
            success: true
        };
        
        testRegisterData = {
            user_id: "@bob:localhost",
            access_token: "abc123"
        };
    
        // registration request
        scope.account.pwd1 = "password";
        scope.account.pwd2 = "password";
        scope.account.desired_user_id = "bob";
        scope.account.email = "foo@bar.com";
        scope.register(); // this depends on the result of a deferred
        rootScope.$digest(); // which is delivered after the digest

        expect(matrixService.register).toHaveBeenCalledWith("bob", "password", true);
        matrixService.register.calls.reset();

        expect(scope.clientSecret).toBeDefined();
        expect(matrixService.linkEmail).toHaveBeenCalledWith("foo@bar.com", scope.clientSecret, 1); // XXX what is sendAttempt?
        
        // token entry
        scope.verifyToken();
        rootScope.$digest();
        
        expect(matrixService.register).toHaveBeenCalledWith("bob", "password", 
            jasmine.objectContaining({
                sid: testEmailLinkData.sid,
                clientSecret: scope.clientSecret
            }), undefined, undefined, true);
        expect(matrixService.saveConfig).toHaveBeenCalled();
    });
});
