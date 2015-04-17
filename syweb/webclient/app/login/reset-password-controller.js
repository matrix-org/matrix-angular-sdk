/*
 Copyright 2015 OpenMarket Ltd
 
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
 
angular.module('ResetPasswordController', ['matrixService'])
.controller('ResetPasswordController', ['$scope', '$rootScope', '$location', 'matrixService', 'eventStreamService', 'dialogService',
                                    function($scope, $rootScope, $location, matrixService, eventStreamService, dialogService) {
    'use strict';
    
    // FIXME: factor out duplication with login-controller.js
    
    // Assume that this is hosted on the home server, in which case the URL
    // contains the home server.
    var hs_url = $location.protocol() + "://" + $location.host();
    if ($location.port() &&
        !($location.protocol() === "http" && $location.port() === 80) &&
        !($location.protocol() === "https" && $location.port() === 443))
    {
        hs_url += ":" + $location.port();
    }

    var generateClientSecret = function() {
        var ret = "";
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < 32; i++) {
            ret += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return ret;
    };

    $scope.stage = 'initial';
    
    $scope.account = {
        homeserver: hs_url,
        identityServer: $location.protocol() + "://matrix.org",
        email: '',
        pwd1: '',
        pwd2: ''
    };
    $scope.working = false;
    
    $scope.reset_password = function() {
        if ($scope.account.pwd1 !== $scope.account.pwd2) {
            $scope.feedback = "Passwords don't match.";
            return;
        }
        else if ($scope.account.pwd1.length < 6) {
            $scope.feedback = "Password must be at least 6 characters.";
            return;
        }
        // set URLs
        matrixService.setConfig({
            homeserver: $scope.account.homeserver,
            identityServer: $scope.account.identityServer
        });
        
        $scope.working = true;
        $scope.clientSecret = generateClientSecret();
        matrixService.linkEmail($scope.account.email, $scope.clientSecret, 1).then(
            function(response) {
                $scope.stage = 'email';
                $scope.sid = response.data.sid;
                $scope.feedback = "";
                $scope.working = false;
            },
            function(error) {
                $scope.stage = 'initial';
                dialogService.showError(error);
                $scope.working = false;
            }
        );
    };

    $scope.verifyToken = function() {
        var authDict = {
            type: 'm.login.email.identity',
            threepidCreds: {
                sid: $scope.sid,
                clientSecret: $scope.clientSecret,
                idServer: $scope.account.identityServer.split('//')[1]
            }
        };
        matrixService.setPassword($scope.account.pwd1, authDict).then(
            function() {
                $scope.feedback = "";
                $scope.working = false;
                $scope.stage = 'done';
            },
            function(error) {
                if (error.status == 401) {
                    dialogService.showError("Failed to verify email address: make sure you clicked the link in the email");
                } else if (error.status == 404) {
                    dialogService.showError("Your email address does not appear to be associated with a Matrix ID on this Home Server");
                    $scope.stage = 'initial';
                } else {
                    dialogService.showError(error);
                }
                $scope.working = false;
            }
        );
    };
}]);

