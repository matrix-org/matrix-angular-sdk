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
 
angular.module('RegisterController', ['matrixService'])
.controller('RegisterController', ['$scope', '$rootScope', '$location', 'matrixService', 'eventStreamService', 'dialogService',
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
        desired_user_id: "",
        desired_user_name: "",
        password: "",
        identityServer: $location.protocol() + "://matrix.org",
        pwd1: "",
        pwd2: "",
        displayName : ""
    };
    $scope.registering = false;
    
    $scope.register = function() {
        // Set the urls
        matrixService.setConfig({
            homeserver: $scope.account.homeserver,
            identityServer: $scope.account.identityServer
        });
        
        if ($scope.account.pwd1 !== $scope.account.pwd2) {
            $scope.feedback = "Passwords don't match.";
            return;
        }
        else if ($scope.account.pwd1.length < 6) {
            $scope.feedback = "Password must be at least 6 characters.";
            return;
        }

        if ($scope.account.email) {
            $scope.clientSecret = generateClientSecret();
            $scope.registering = true;
            matrixService.linkEmail($scope.account.email, $scope.clientSecret, 1).then(
                function(response) {
                    $scope.wait_3pid_code = true;
                    $scope.sid = response.data.sid;
                    $scope.feedback = "";
                    $scope.registering = false;
                },
                function(error) {
                    dialogService.showError(error);
                    $scope.registering = false;
                }
            );
        } else {
            $scope.registerWithMxidAndPassword($scope.account.desired_user_id, $scope.account.pwd1);
        }
    };

    $scope.registerWithMxidAndPassword = function(mxid, password, threepidCreds, captchaResponse) {
        $scope.registering = true;
        matrixService.register(mxid, password, threepidCreds, captchaResponse).then(
            function(response) {
                $scope.registering = false;
                $scope.feedback = "Success";
                if (grecaptcha) grecaptcha.reset();
                // Update the current config 
                var config = matrixService.config();
                angular.extend(config, {
                    access_token: response.data.access_token,
                    user_id: response.data.user_id
                });
                matrixService.setConfig(config);

                // And permanently save it
                matrixService.saveConfig();
                
                $rootScope.onLoggedIn();
                
                if ($scope.account.displayName) {
                    // FIXME: handle errors setting displayName
                    matrixService.setDisplayName($scope.account.displayName);
                }
                
                 // Go to the user's rooms list page
                $location.url("home");
            },
            function(error) {
                $scope.registering = false;
                console.error("Registration error: "+JSON.stringify(error));
                if (error.authfailed) {
                    if (error.authfailed === "m.login.recaptcha") {
                        $scope.captchaMessage = "Verification failed. Are you sure you're not a robot?";
                        if (grecaptcha) grecaptcha.reset();
                    } else {
                        dialogService.showError("Authentication failed");
                        $scope.stage = 'initial';
                        if (grecaptcha) grecaptcha.reset();
                    }
                } else {
                    if (error.data.errcode === "M_USER_IN_USE") {
                        dialogService.showMatrixError("Username taken", error.data);
                        $scope.reenter_username = true;
                        $scope.stage = 'initial';
                        if (grecaptcha) grecaptcha.reset();
                    }
                    else if (error.data.errcode == "M_CAPTCHA_NEEDED") {
                        $scope.stage = 'captcha';
                        grecaptcha.render("regcaptcha", {
                            sitekey: error.data.public_key,
                            callback: function(response) {
                                $scope.registerWithMxidAndPassword(mxid, password, threepidCreds, response);
                            }
                        });
                    }
                    else {
                        dialogService.showError(error);
                        $scope.stage = 'initial';
                        if (grecaptcha) grecaptcha.reset();
                    }
                }
            });
    }

    $scope.verifyToken = function() {
        matrixService.authEmail($scope.clientSecret, $scope.sid, $scope.account.threepidtoken).then(
            function(response) {
                if (!response.data.success) {
                    $scope.feedback = "Unable to verify code.";
                } else {
                    $scope.registerWithMxidAndPassword($scope.account.desired_user_id, $scope.account.pwd1, [{'sid':$scope.sid, 'clientSecret':$scope.clientSecret, 'idServer': $scope.account.identityServer.split('//')[1]}]);
                }
            },
            function(error) {
                $scope.feedback = "Unable to verify code.";
            }
        );
    };
}]);

