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

    // Check browser support
    // Support IE from 9.0. AngularJS needs some tricks to run on IE8 and below
    /* FIXME: $.browser.version was removed in jquery 1.9
    var version = parseFloat($.browser.version);
    if ($.browser.msie && version < 9.0) {
        $rootScope.unsupportedBrowser = {
            browser: navigator.userAgent,
            reason: "Internet Explorer is supported from version 9"
        };
    } */
    // The app requires localStorage
    if(typeof(Storage) === "undefined") {
        $rootScope.unsupportedBrowser = {
            browser: navigator.userAgent,
            reason: "It does not support HTML local storage"
        };
    }

    // If user auth details are not in cache, go to the login page
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
        if (!matrixService.isUserLoggedIn() && $location.path() !== "/login" &&
                $location.path() !== "/register" && $location.path() !== "/reset-password") {
            $location.path("login");
        }
    });

}]);
