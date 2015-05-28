/*
Copyright 2014 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var matrixWebClient = angular.module('matrixWebClient', [
    'ngRoute',
    'MatrixWebClientController',
    'LoginController',
    'ResetPasswordController',
    'RegisterController',
    'RoomController',
    'HomeController',
    'RecentsController',
    'RecentsFilter',
    'SettingsController',
    'PaymentController',
    'UserController',
    'paymentService',
    'matrixService',
    'webRtcService',
    'matrixPhoneService',
    'MatrixCall',
    'eventStreamService',
    'eventHandlerService',
    'eventReaperService',
    'notificationService',
    'dialogService',
    'recentsService',
    'modelService',
    'commandsService',
    'typingService',
    'versionService',
    'infinite-scroll',
    'ui.bootstrap',
    'dialogs.main',
    'angularSpinner',
    'monospaced.elastic'
]);

matrixWebClient.config(['$routeProvider', '$provide', '$httpProvider',
    function($routeProvider, $provide, $httpProvider) {
        $routeProvider.
            when('/login', {
                templateUrl: 'app/login/login.html'
            }).
            when('/register', {
                templateUrl: 'app/login/register.html'
            }).
            when('/reset-password', {
                templateUrl: 'app/login/reset-password.html'
            }).
            when('/room/:room_id_or_alias', {
                templateUrl: 'app/room/room.html'
            }).
            when('/room/', {    // room URL with room alias in it (ex: http://127.0.0.1:8000/#/room/#public:localhost:8080) will come here.
                                // The reason is that 2nd hash key breaks routeProvider parameters cutting so that the URL will not match with 
                                // the previous '/room/:room_id_or_alias' URL rule
                templateUrl: 'app/room/room.html'
            }).
            when('/', {
                templateUrl: 'app/home/home.html'
            }).
            when('/settings', {
                templateUrl: 'app/settings/settings.html'
            }).
            when('/payment', {
                templateUrl: 'app/payment/payment.html'
            }).
            when('/payment/:payment_state', {
                templateUrl: 'app/payment/state.html'
            }).
            when('/user/:user_matrix_id', {
                templateUrl: 'app/user/user.html'
            }).
            otherwise({
                redirectTo: '/'
            });
            
        $provide.factory('AccessTokenInterceptor', ['$q', '$rootScope', 
            function ($q, $rootScope) {
            return {
                responseError: function(rejection) {
                    if ("data" in rejection && rejection.data && typeof rejection.data == 'object' &&
                            "errcode" in rejection.data && 
                            rejection.data.errcode === "M_UNKNOWN_TOKEN") {
                        console.log("Got a 403 with an unknown token. Logging out.")
                        $rootScope.$broadcast("M_UNKNOWN_TOKEN");
                    }
                    return $q.reject(rejection);
                }
            };
        }]);
        $httpProvider.interceptors.push('AccessTokenInterceptor');
    }]);

matrixWebClient.run(['$location', '$rootScope', 'matrixService', function($location, $rootScope, matrixService) {
    $rootScope.httpUri = matrixService.getHttpUriForMxc;

    // Source: https://msdn.microsoft.com/en-us/library/cc817582.aspx
    // Returns the version of Windows Internet Explorer or a -1
    // (indicating the use of another browser).
    function getInternetExplorerVersion() {
        var rv = -1; // Return value assumes failure.
        if (!navigator) {
            return rv;
        }
        if (navigator.appName == 'Microsoft Internet Explorer') {
            var ua = navigator.userAgent;
            var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
            if (re.exec(ua) != null) {
                rv = parseFloat( RegExp.$1 );
            }
        }
        return rv;
    }

    // Check browser support. Fail gracefully and display an error message
    // if running on IE8 and below.
    var ieVersion = getInternetExplorerVersion();
    if (ieVersion > -1 && ieVersion < 9.0) {
        $rootScope.unsupportedBrowser = {
            browser: navigator.userAgent,
            reason: "Internet Explorer is supported from version 9."
        };
    }
    // The app requires localStorage
    if(typeof(Storage) === "undefined") {
        $rootScope.unsupportedBrowser = {
            browser: navigator.userAgent,
            reason: "Your browser does not support HTML local storage."
        };
    }

    // If user auth details are not in cache, go to the login page
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
        var unauthenticatedPages = ["/register", "/reset-password", "/login"];
        if (!matrixService.isUserLoggedIn() && unauthenticatedPages.indexOf($location.path()) === -1) {
            $location.path("login");
        }
    });

}]);
