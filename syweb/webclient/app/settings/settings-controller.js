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
['$scope', 'matrixService', 'modelService', 'eventHandlerService', 'notificationService', 'mFileUpload', 'dialogService', 'paymentService', 'versionService',
function($scope, matrixService, modelService, eventHandlerService, notificationService, mFileUpload, dialogService, paymentService, versionService) {
    versionService.getVersion().then(function() {
        $scope.appVersion = versionService.version;
    });

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
        notificationService.getRulesets().then(function(rulesets) {
            $scope.settings.rules = rulesets.global;

            var rule_descriptions = {
                '.m.rule.contains_user_name': "Notify with sound for messages that contain my user name",
                '.m.rule.contains_display_name': "Notify with sound for messages that contain my display name",
                '.m.rule.room_one_to_one': "Notify with sound for messages to just me",
                '.m.rule.suppress_notices': "Suppress notifications for all automated messages",
                '.m.rule.invite_for_me': "Notify me when I'm invited to a new room",
                '.m.rule.member_event': "Notify me when people join or leave rooms",
                '.m.rule.message': "Notify for messages that don't match any other rule",
                '.m.rule.call': "Notify me when I receive a call",
                '.m.rule.fallback': "Notify me for anything else"
            };

            var defaultRules = [];
            for (var kind in rulesets.global) {
                for (var i = 0; i < Object.keys(rulesets.global[kind]).length; ++i) {
                    var r = rulesets.global[kind][i];
                    if (r.rule_id[0] == '.' && rule_descriptions[r.rule_id]) {
                        r.description = rule_descriptions[r.rule_id];
                        r.kind = kind;
                        defaultRules.push(r);
                    }
                }
            }
            $scope.settings.default_rules = defaultRules;
        });
    };

    $scope.rule_add_action = {
        content: "notify",
        room: "notify",
        sender: "notify"
    };
    $scope.rule_add_sound = {
        content: null,
        room: null,
        sender: null
    };
    $scope.rule_highlight = {
        content: false,
        room: false,
        sender: false
    };
    $scope.rule_add_inprogress = {
        content: false,
        room: false,
        sender: false
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
    };
    
    $scope.updateAudioNotification = function() {
        console.log("Play audio with notifications: "+$scope.settings.audioNotifications);
        var config = matrixService.config();
        config.audioNotifications = $scope.settings.audioNotifications;
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

    $scope.addContentRule = function() {
        var actions = [ $scope.rule_add_action.content ];
        if ($scope.rule_add_sound.content) {
            actions.push({'set_tweak': 'sound', 'value': 'default'});
        }
        actions.push({'set_tweak': 'highlight', 'value': $scope.rule_highlight.content});
        notificationService.addGlobalContentRule($scope.content_rule_add_input, actions).then(function() {
            $scope.rule_add_inprogress.content = false;
            notificationService.clearRulesCache();
            fetchRules();
            $scope.content_rule_add_input = '';
        }, function() {
            $scope.rule_add_inprogress.content = false;
            $scope.feedback = "Failed to add rule";
        });
        $scope.rule_add_inprogress.content = true;
    };

    $scope.addRoomRule = function() {
        var actions = [ $scope.rule_add_action.room ];
        if ($scope.rule_add_sound.room) {
            actions.push({'set_tweak': 'sound', 'value': 'default'});
        }
        actions.push({'set_tweak': 'highlight', 'value': $scope.rule_highlight.room});
        notificationService.addGlobalRoomRule($scope.room_rule_add_input, actions).then(function() {
            $scope.rule_add_inprogress.room = false;
            notificationService.clearRulesCache();
            fetchRules();
        }, function() {
            $scope.rule_add_inprogress.room = false;
            $scope.feedback = "Failed to add rule";
        });
        $scope.rule_add_inprogress.room = true;
    };

    $scope.addSenderRule = function() {
        var actions = [ $scope.rule_add_action.sender ];
        if ($scope.rule_add_sound.sender) {
            actions.push({'set_tweak': 'sound', 'value': 'default'});
        }
        actions.push({'set_tweak': 'highlight', 'value': $scope.rule_highlight.sender});
        notificationService.addGlobalSenderRule($scope.sender_rule_add_input, actions).then(function() {
            $scope.rule_add_inprogress.sender = false;
            notificationService.clearRulesCache();
            fetchRules();
            $scope.sender_rule_add_input = '';
        }, function() {
            $scope.rule_add_inprogress.sender = false;
            $scope.feedback = "Failed to add rule";
        });
        $scope.rule_add_inprogress.sender = true;
    };

    $scope.deleteContentRule = function(rule) {
        notificationService.deleteGlobalContentRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
        rule.inprogress = true;
    };

    $scope.deleteRoomRule = function(rule) {
        notificationService.deleteGlobalRoomRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
        rule.inprogress = true;
    };

    $scope.deleteSenderRule = function(rule) {
        notificationService.deleteGlobalSenderRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        });
        rule.inprogress = true;
    };

    $scope.updateDefaultRule = function(rule) {
        rule.inprogress = true;
        matrixService.setPushRuleEnabled('global', rule.kind, rule.rule_id, rule.enabled).then(function() {
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
        } else if (a.set_tweak == 'highlight') {
            if (a.value == undefined || a.value) return "highlight";
            return "";
        }
        return "other action";
    };

    $scope.payment = {
        url: window.webClientConfig ? window.webClientConfig.paymentUrl : "",
        credit: "-"
    };

    paymentService.getCredit().then(function(credit) {
        $scope.payment.credit = credit;
    });

    $scope.getCredit = function() {
        if (paymentService.hasAcceptedEula()) {
            $scope.goToPage("payment");
            return;
        }
        paymentService.getEula().then(function(response) {
            dialogService.showConfirm("OpenMarket Matrix API End User License Agreement", response.data).then(
            function(btn) {
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
