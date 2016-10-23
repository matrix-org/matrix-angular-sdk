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
 
angular.module('LoginController', ['matrixService'])
.controller('LoginController', ['$scope', '$rootScope', '$location', 'matrixService', 'dialogService',
                                    function($scope, $rootScope, $location, matrixService, dialogService) {
    'use strict';
    
    
    // Assume that this is hosted on the home server, in which case the URL
    // contains the home server.
    var location_protocol = $location.protocol();
    var location_host = $location.host();
    var id_host = "matrix.org"
    var id_url = $location.protocol() + "://" + id_host;
    if (location_protocol === "file") {
        location_protocol = "https";
        location_host = id_host;
	    id_url = location_protocol + "://" + location_host;
    }
    var hs_url = location_protocol + "://" + location_host;
    if ($location.port() &&
        !(location_protocol === "http" && $location.port() === 80) &&
        !(location_protocol=== "https" && $location.port() === 443))
    {
        hs_url += ":" + $location.port();
    }
    
    $scope.account = {
        homeserver: hs_url,
        desired_user_name: "",
        user_id: "",
        password: "",
        identityServer: id_url,
        pwd1: "",
        pwd2: "",
    };
    
    $scope.login_types = [ "email", "mxid" ];
    $scope.login_type_label = {
        "email": "Email address",
        "mxid": "Matrix ID (e.g. @bob:matrix.org or bob)",
    };
    $scope.login_type = 'mxid'; // TODO: remember the user's preferred login_type
    
    $scope.login = function() {
        matrixService.setConfig({
            homeserver: $scope.account.homeserver,
            identityServer: $scope.account.identityServer,
        });
        switch ($scope.login_type) {
            case 'mxid':
                $scope.login_with_mxid($scope.account.user_id, $scope.account.password);
                break;
            case 'email':
                matrixService.lookup3pid('email', $scope.account.user_id).then(
                    function(response) {
                        if (response.data['address'] == undefined) {
                            $scope.login_error_msg = "Invalid email address / password";
                        } else {
                            console.log("Got address "+response.data['mxid']+" for email "+$scope.account.user_id);
                            $scope.login_with_mxid(response.data['mxid'], $scope.account.password);
                        }
                    },
                    function() {
                        $scope.login_error_msg = "Couldn't look up email address. Is your identity server set correctly?";
                    }
                );
        }
    };

    $scope.login_with_mxid = function(mxid, password) {
        matrixService.setConfig({
            homeserver: $scope.account.homeserver,
            identityServer: $scope.account.identityServer,
            user_id: $scope.account.user_id
        });
        // try to login
        matrixService.login(mxid, password).then(
            function(response) {
                if ("access_token" in response.data) {
                    $scope.feedback = "Login successful.";
                    matrixService.setConfig({
                        homeserver: $scope.account.homeserver,
                        identityServer: $scope.account.identityServer,
                        user_id: response.data.user_id,
                        access_token: response.data.access_token
                    });
                    matrixService.saveConfig();
                    $rootScope.onLoggedIn();
                    $location.url("home");
                }
                else {
                    $scope.feedback = "Failed to login: " + JSON.stringify(response.data);
                }
            },
            function(error) {
                if (error.status != 403) {
                    dialogService.showError(error);
                }
                else {
                    dialogService.showError("Incorrect username or password.");
                }
            }
        );
    };
}]);

