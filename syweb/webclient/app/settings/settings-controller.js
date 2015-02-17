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

'use strict';

angular.module('SettingsController', ['matrixService', 'modelService', 'eventHandlerService', 'mFileUpload', 'mFileInput'])
.controller('SettingsController', 
['$scope', 'matrixService', 'modelService', 'eventHandlerService', 'notificationService', 'mFileUpload', 'dialogService', 'paymentService',
function($scope, matrixService, modelService, eventHandlerService, notificationService, mFileUpload, dialogService, paymentService) {
    // XXX: duplicated from register
    var generateClientSecret = function() {
        var ret = "";
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < 32; i++) {
            ret += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return ret;
    };
    
    var setMuteNotifications = function(mute) {
        var config = matrixService.config();
        config.muteNotifications = mute;
        matrixService.setConfig(config);
        matrixService.saveConfig();
        $scope.config = matrixService.config();
    };

    function fetchRules() {
        notificationService.getGlobalRulesets().then(function(rulesets) {
            $scope.settings.rules = rulesets;
        });
    };

    $scope.rule_add_action = {
        content: "notify",
        room: "notify",
        sender: "notify"
    };

    eventHandlerService.waitForInitialSyncCompletion().then(function() {
        $scope.rooms = modelService.getRooms();
    });
    
    $scope.config = matrixService.config();
    
    $scope.httpUri = matrixService.getHttpUriForMxc;

    $scope.profile = {
        displayName: "",
        avatarUrl: ""
    };

    // The profile as stored on the server
    $scope.profileOnServer = {
        displayName: "",
        avatarUrl: ""
    };

    $scope.onInit = function() {
        // Load profile data
        // Display name
        matrixService.getDisplayName($scope.config.user_id).then(
            function(response) {
                $scope.profile.displayName = response.data.displayname;
                $scope.profileOnServer.displayName = response.data.displayname;
            },
            function(error) {
                $scope.feedback = "Can't load display name";
            } 
        );
        // Avatar
        matrixService.getProfilePictureUrl($scope.config.user_id).then(
            function(response) {
                $scope.profile.avatarUrl = response.data.avatar_url;
                $scope.profileOnServer.avatarUrl = response.data.avatar_url;
            },
            function(error) {
                $scope.feedback = "Can't load avatar URL";
            } 
        );
        fetchRules();
    };

    $scope.$watch("profile.avatarFile", function(newValue, oldValue) {
        if ($scope.profile.avatarFile) {
            console.log("Uploading new avatar file...");
            mFileUpload.uploadFile($scope.profile.avatarFile).then(
                function(url) {
                    $scope.profile.avatarUrl = url;
                },
                function(error) {
                    dialogService.showError(error);
                } 
            );
        }
    });
    
    $scope.saveProfile = function() {
        if ($scope.profile.displayName !== $scope.profileOnServer.displayName) {
            setDisplayName($scope.profile.displayName);
        }
        if ($scope.profile.avatarUrl !== $scope.profileOnServer.avatarUrl) {
            setAvatar($scope.profile.avatarUrl);
        }
    };
    
    var setDisplayName = function(displayName) {
        matrixService.setDisplayName(displayName).then(
            function(response) {
                dialogService.showSuccess("Success", "Updated display name.");
            },
            function(error) {
                dialogService.showError(error);
            }
        );
    };

    var setAvatar = function(avatarURL) {
        console.log("Updating avatar to " + avatarURL);
        matrixService.setProfilePictureUrl(avatarURL).then(
            function(response) {
                dialogService.showSuccess("Success", "Updated profile avatar.");
            },
            function(error) {
                dialogService.showError(error);
            }
        );
    };

    $scope.linkedEmails = {
        linkNewEmail: "", // the email entry box
        emailBeingAuthed: undefined, // to populate verification text
        authSid: undefined, // the token id from the IS
        emailCode: "", // the code entry box
        linkedEmailList: matrixService.config().emailList // linked email list
    };
    
    $scope.linkEmail = function(email) {
        if (email != $scope.linkedEmails.emailBeingAuthed) {
            $scope.linkedEmails.emailBeingAuthed = email;
            $scope.clientSecret = generateClientSecret();
            $scope.sendAttempt = 0;
        }
        $scope.sendAttempt++;
        matrixService.linkEmail(email, $scope.clientSecret, $scope.sendAttempt).then(
            function(response) {
                if (response.data.success === true) {
                    $scope.linkedEmails.authSid = response.data.sid;
                    $scope.emailFeedback = "You have been sent an email.";
                    $scope.linkedEmails.emailBeingAuthed = email;
                }
                else {
                    $scope.emailFeedback = "Failed to send email.";
                }
            },
            function(error) {
                $scope.emailFeedback = "Can't send email: " + error.data;
            }
        );
    };

    $scope.submitEmailCode = function() {
        var tokenId = $scope.linkedEmails.authSid;
        if (tokenId === undefined) {
            $scope.emailFeedback = "You have not requested a code with this email.";
            return;
        }
        matrixService.authEmail($scope.clientSecret, $scope.linkedEmails.authSid, $scope.linkedEmails.emailCode).then(
            function(response) {
                if ("errcode" in response.data) {
                    $scope.emailFeedback = "Failed to authenticate email.";
                    return;
                }
                matrixService.bindEmail(matrixService.config().user_id, tokenId, $scope.clientSecret).then(
                    function(response) {
                         if ('errcode' in response.data) {
                             $scope.emailFeedback = "Failed to link email.";
                             return;
                         }
                         var config = matrixService.config();
                         var emailList = {};
                         if ("emailList" in config) {
                             emailList = config.emailList;
                         }
                         emailList[$scope.linkedEmails.emailBeingAuthed] = response;
                         // save the new email list
                         config.emailList = emailList;
                         matrixService.setConfig(config);
                         matrixService.saveConfig();
                         // invalidate the email being authed and update UI.
                         $scope.linkedEmails.emailBeingAuthed = undefined;
                         $scope.emailFeedback = "";
                         $scope.linkedEmails.linkedEmailList = emailList;
                         $scope.linkedEmails.linkNewEmail = "";
                         $scope.linkedEmails.emailCode = "";
                    }, function(reason) {
                        $scope.emailFeedback = "Failed to link email: " + reason;
                    }
                );
            },
            function(reason) {
                $scope.emailFeedback = "Failed to auth email: " + reason;
            }
        );
    };
    
    
    /*** Desktop notifications section ***/
    $scope.settings = {
        notifications: undefined,
        audioNotifications: matrixService.config().audioNotifications,
        bingWords: matrixService.config().bingWords
    };
    
    $scope.updateAudioNotification = function() {
        console.log("Play audio with notifications: "+$scope.settings.audioNotifications);
        var config = matrixService.config();
        config.audioNotifications = $scope.settings.audioNotifications;
        matrixService.setConfig(config);
        matrixService.saveConfig();
    };
    
    $scope.saveBingWords = function() {
        console.log("Saving words: "+JSON.stringify($scope.settings.bingWords));
        var config = matrixService.config();
        config.bingWords = $scope.settings.bingWords;
        matrixService.setConfig(config);
        matrixService.saveConfig();
    };

    // If the browser supports it, check the desktop notification state
    if ("Notification" in window) {
        $scope.settings.notifications = window.Notification.permission;
    }

    $scope.requestNotifications = function() {
        console.log("requestNotifications");
        window.Notification.requestPermission(function (permission) {
            console.log("   -> User decision: " + permission);
            $scope.settings.notifications = permission;
        });
    };
    
    $scope.toggleMute = function() {
        setMuteNotifications(!$scope.config.muteNotifications);
    };

    $scope.addContentRule = function(pattern, actions) {
        notificationService.addGlobalContentRule(pattern, actions).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
    };

    $scope.addRoomRule = function(room_id, actions) {
        notificationService.addGlobalRoomRule(room_id, actions).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
    };

    $scope.addSenderRule = function(sender_id, actions) {
        notificationService.addGlobalSenderRule(sender_id, actions).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
    };

    $scope.deleteContentRule = function(rule) {
        notificationService.deleteGlobalContentRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
    };

    $scope.deleteRoomRule = function(rule) {
        notificationService.deleteGlobalRoomRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
    };

    $scope.deleteSenderRule = function(rule) {
        notificationService.deleteGlobalSenderRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
    };

    $scope.stringForAction = function(a) {
        if (a == 'notify') {
            return "Always Notify";
        } else if (a == 'dont_notify') {
            return "Never Notify";
        } else if (a.set_tweak == 'sound') {
            return "custom sound";
        }
        return "other action";
    };

    $scope.payment = {
        url: webClientConfig.paymentUrl,
        credit: paymentService.getCredit()
    };

    $scope.getCredit = function() {
        if (paymentService.hasAcceptedEula()) {
            $scope.goToPage("payment");
            return;
        }
        paymentService.getEula().then(function(response) {
            dialogService.showConfirm("EULA", response.data).then(function(btn) {
                paymentService.acceptEula();
                $scope.goToPage("payment");
            },
            function(btn) {
                console.log("EULA rejected.");
            });
        },
        function(err) {
            dialogService.showError(err);
        });
    };
}]);
