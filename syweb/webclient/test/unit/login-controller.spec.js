describe("LoginController ", function() {
    var rootScope, scope, ctrl, $q, $timeout;
    
    // mock services
    var matrixService = {
        config: function() {
            return {
                user_id: userId
            }
        },
        setConfig: function(){},
        lookup3pid: function(){},
        login: function(){},
        saveConfig: function(){}
    };
    var location = {
        protocol: function(){},
        port: function(){},
        host: function(){},
        url: function(){}
    };
    var dialogService = {
        showError: function(err){}
    };
    
    beforeEach(function() {
        module('LoginController');
    });

    beforeEach(inject(function($rootScope, $injector, $location, $controller, _$q_, _$timeout_) {
            $q = _$q_;
            $timeout = _$timeout_;
            scope = $rootScope.$new();
            rootScope = $rootScope;
            rootScope.onLoggedIn = function(){};
            ctrl = $controller('LoginController', {
                '$scope': scope,
                '$rootScope': $rootScope, 
                '$location': location,
                'matrixService': matrixService,
                'dialogService': dialogService
            });
        })
    );

    it('should be able to login with a matrix ID.', function() {
        var loginDefer = $q.defer();
        spyOn(matrixService, "login").and.returnValue(loginDefer.promise);
        spyOn(matrixService, "setConfig");
        spyOn(rootScope, "onLoggedIn");
        spyOn(matrixService, "saveConfig");
    
        scope.login_type = 'mxid';
        scope.account.user_id = "@example:matrix.org";
        scope.account.password = "mypassword";
        scope.login();
        
        expect(matrixService.login).toHaveBeenCalledWith(scope.account.user_id, scope.account.password);
        loginDefer.resolve({data:{access_token:"foobar",user_id:"@example:matrix.org"}});
        scope.$digest();
        
        expect(matrixService.setConfig).toHaveBeenCalledWith(jasmine.objectContaining({
            access_token: "foobar",
            user_id: "@example:matrix.org"
        }));
        expect(matrixService.saveConfig).toHaveBeenCalled();
        expect(rootScope.onLoggedIn).toHaveBeenCalled();
    });
    
    it('should be able to login with an email address.', function() {
        var loginDefer = $q.defer();
        var lookupDefer = $q.defer();
        spyOn(matrixService, "login").and.returnValue(loginDefer.promise);
        spyOn(matrixService, "lookup3pid").and.returnValue(lookupDefer.promise);
        spyOn(matrixService, "setConfig");
        spyOn(rootScope, "onLoggedIn");
        spyOn(matrixService, "saveConfig");
    
        scope.login_type = 'email';
        scope.account.user_id = "example@email.com";
        scope.account.password = "mypassword";
        scope.login();
        
        expect(matrixService.lookup3pid).toHaveBeenCalledWith("email", scope.account.user_id);
        var username = "@bob:matrix.org";
        lookupDefer.resolve({data:{address:"example@email.com", mxid: username}});
        scope.$digest();
        
        expect(matrixService.login).toHaveBeenCalledWith(username, scope.account.password);
        loginDefer.resolve({data:{access_token:"foobar",user_id:"@example:matrix.org"}});
        scope.$digest();
        
        expect(matrixService.setConfig).toHaveBeenCalledWith(jasmine.objectContaining({
            access_token: "foobar",
            user_id: "@example:matrix.org"
        }));
        expect(matrixService.saveConfig).toHaveBeenCalled();
        expect(rootScope.onLoggedIn).toHaveBeenCalled();
    });
    
    it('should show an error if the login request fails.', function() {
        var loginDefer = $q.defer();
        spyOn(matrixService, "login").and.returnValue(loginDefer.promise);
        spyOn(dialogService, "showError");
    
        scope.login_type = 'mxid';
        scope.account.user_id = "@example:matrix.org";
        scope.account.password = "mypassword";
        scope.login();
        
        expect(matrixService.login).toHaveBeenCalledWith(scope.account.user_id, scope.account.password);
        loginDefer.reject("Rejected!");
        scope.$digest();
        
        expect(dialogService.showError).toHaveBeenCalled();
    });
});
