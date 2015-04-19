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
                '.m.rule.master': '',
                '.m.rule.contains_user_name': "Notify me with sound about messages that contain my user name",
                '.m.rule.contains_display_name': "Notify me with sound about messages that contain my display name",
                '.m.rule.room_one_to_one': "Notify me with sound about messages sent just to me",
                '.m.rule.suppress_notices': "Suppress notifications from bots",
                '.m.rule.invite_for_me': "Notify me when I'm invited to a new room",
                '.m.rule.member_event': "Notify me when people join or leave rooms",
                '.m.rule.message': "Notify for all other messages/rooms",
                '.m.rule.call': "Notify me when I receive a call",
                '.m.rule.fallback': "Notify me for anything else"
            };
            var rule_categories = {
                '.m.rule.master': 'master',
                '.m.rule.suppress_notices': 'suppression',
                '.m.rule.message': 'fallthrough',
                '.m.rule.call': 'call',
            };

            var defaultRules = {master: [], additional: [], call: [], fallthrough: [], suppression: []};
            for (var kind in rulesets.global) {
                for (var i = 0; i < Object.keys(rulesets.global[kind]).length; ++i) {
                    var r = rulesets.global[kind][i];
                    var cat = rule_categories[r.rule_id];
                    r.kind = kind;
                    if (r.rule_id[0] == '.' && rule_descriptions[r.rule_id] !== undefined) {
                        r.description = rule_descriptions[r.rule_id];
                        if (cat) {
                            defaultRules[cat].push(r);
                        } else {
                            defaultRules.additional.push(r);
                        }
                    }
                }
            }
            $scope.settings.default_rules = defaultRules;
            if (defaultRules.master.length > 0) {
                $scope.settings.push_master_rule = defaultRules.master[0];
            }
        });
    };

    var fetchThreepids = function() {
        $scope.linkedEmails.fetchingEmailList = true;
        matrixService.getThreePids().then(function(response) {
            $scope.linkedEmails.fetchingEmailList = false;
            $scope.linkedEmails.linkedEmailList = response.data.threepids;
        }, function() {
            $scope.linkedEmails.fetchingEmailList = false;
        });
    };


    $scope.rule_add = {
        input:  {
            content: '',
            room: '',
            sender: ''
        }, action: {
            content: "notify",
            room: "notify",
            sender: "notify"
        }, sound: {
            content: null,
            room: null,
            sender: null
        }, highlight: {
            content: false,
            room: false,
            sender: false
        }, inprogress: {
            content: false,
            room: false,
            sender: false
        }
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

    $scope.password = {
        oldpw: '',
        newpw: '',
        confirmnewpw: '',
        inprogress: false,
        feedback: '',
        state: null,
        badfields: {}
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
        fetchThreepids();
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
                $scope.profileOnServer.displayName = displayName;
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
                $scope.profileOnServer.avatarUrl = avatarURL;
                dialogService.showSuccess("Success", "Updated profile avatar.");
            },
            function(error) {
                dialogService.showError(error);
            }
        );
    };

    $scope.linkedEmails = {
        linkNewEmail: "", // the email entry box
        bindNewEmail: true,
        emailBeingAuthed: undefined, // to populate verification text
        authSid: undefined, // the token id from the IS
        emailCode: "", // the code entry box
        linkedEmailList: [], // linked email list
        fetchingEmailList: false
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

    $scope.submitEmailVerify = function() {
        var tokenId = $scope.linkedEmails.authSid;
        if (tokenId === undefined) {
            $scope.emailFeedback = "You have not requested a code with this email.";
            return;
        }
        matrixService.addThreePid({
            sid: $scope.linkedEmails.authSid,
            clientSecret: $scope.clientSecret,
            idServer: matrixService.config().identityServer.split('//')[1]
        }, $scope.linkedEmails.bindNewEmail).then(function() {
             // invalidate the email being authed and update UI.
             $scope.linkedEmails.emailBeingAuthed = undefined;
             $scope.emailFeedback = "";
             $scope.linkedEmails.linkNewEmail = "";
             $scope.linkedEmails.emailCode = "";

            fetchThreepids();
        }, function() {
            $scope.emailFeedback = "Email auth failed.";
            return;
        });
    }
    
    
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
        var actions = [ $scope.rule_add.action.content ];
        if ($scope.rule_add.sound.content) {
            actions.push({'set_tweak': 'sound', 'value': 'default'});
        }
        actions.push({'set_tweak': 'highlight', 'value': $scope.rule_add.highlight.content});
        notificationService.addGlobalContentRule($scope.rule_add.input.content, actions).then(function() {
            $scope.rule_add.inprogress.content = false;
            notificationService.clearRulesCache();
            fetchRules();
            $scope.rule_add.input.content = '';
        }, function() {
            $scope.rule_add.inprogress.content = false;
            $scope.feedback = "Failed to add rule";
        });
        $scope.rule_add.inprogress.content = true;
    };

    $scope.addRoomRule = function() {
        var actions = [ $scope.rule_add.action.room ];
        if ($scope.rule_add.sound.room) {
            actions.push({'set_tweak': 'sound', 'value': 'default'});
        }
        actions.push({'set_tweak': 'highlight', 'value': $scope.rule_add.highlight.room});
        notificationService.addGlobalRoomRule($scope.rule_add.input.room, actions).then(function() {
            $scope.rule_add.inprogress.room = false;
            notificationService.clearRulesCache();
            fetchRules();
            $scope.rule_add.input.room = '';
        }, function() {
            $scope.rule_add.inprogress.room = false;
            $scope.feedback = "Failed to add rule";
        });
        $scope.rule_add.inprogress.room = true;
    };

    $scope.addSenderRule = function() {
        var actions = [ $scope.rule_add.action.sender ];
        if ($scope.rule_add.sound.sender) {
            actions.push({'set_tweak': 'sound', 'value': 'default'});
        }
        actions.push({'set_tweak': 'highlight', 'value': $scope.rule_add.highlight.sender});
        notificationService.addGlobalSenderRule($scope.rule_add.input.sender, actions).then(function() {
            $scope.rule_add.inprogress.sender = false;
            notificationService.clearRulesCache();
            fetchRules();
            $scope.rule_add.input.sender = '';
        }, function() {
            $scope.rule_add.inprogress.sender = false;
            $scope.feedback = "Failed to add rule";
        });
        $scope.rule_add.inprogress.sender = true;
    };

    $scope.deleteContentRule = function(rule) {
        notificationService.deleteGlobalContentRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        }, function() {
            rule.inprogress = false;
            $scope.feedback = "Failed to delete rule";
        });
        rule.inprogress = true;
    };

    $scope.deleteRoomRule = function(rule) {
        notificationService.deleteGlobalRoomRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        }, function() {
            rule.inprogress = false;
            $scope.feedback = "Failed to delete rule";
        });
        rule.inprogress = true;
    };

    $scope.deleteSenderRule = function(rule) {
        notificationService.deleteGlobalSenderRule(rule['rule_id']).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        }, function() {
            rule.inprogress = false;
            $scope.feedback = "Failed to delete rule";
        });
        rule.inprogress = true;
    };

    $scope.updateRuleEnabled = function(rule) {
        rule.inprogress = true;
        matrixService.setPushRuleEnabled('global', rule.kind, rule.rule_id, rule.enabled).then(function() {
            notificationService.clearRulesCache();
            fetchRules();
        }, function() {
            rule.inprogress = false;
            $scope.feedback = "Failed to update rule";
        });
    };

    $scope.stringForAction = function(a) {
        if (a == 'notify') {
            return "Always notify";
        } else if (a == 'dont_notify') {
            return "Never notify";
        } else if (a.set_tweak == 'sound') {
            return "Custom sound";
        } else if (a.set_tweak == 'highlight') {
            if (a.value == undefined || a.value) return "Highlight";
            return "";
        }
        return "Other action";
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

    $scope.passwordValid = function() {
        if ($scope.password.oldpw == '') {
            return false;
        }
        if ($scope.password.newpw == '') {
            return false;
        }
        if ($scope.password.confirmnewpw == '') {
            return false;
        }
        return true;
    };

    $scope.changePassword = function() {
        if ($scope.password.newpw != $scope.password.confirmnewpw) {
            $scope.password.feedback = "Passwords don't match";
            $scope.password.state = "error";
            $scope.password.badfields = [ 'newpw', 'confirmnewpw' ];
            return;
        }
        var authDict = {
            type: 'm.login.password',
            user: matrixService.config().user_id,
            password: $scope.password.oldpw
        };
        $scope.password.inprogress = true;
        matrixService.setPassword($scope.password.newpw, authDict).then(function() {
            $scope.password.feedback = "Password changed";
            $scope.password.state = 'changed';
            $scope.password.badfields = [];
            $scope.password.oldpw = '';
            $scope.password.newpw = '';
            $scope.password.confirmnewpw = '';
            $scope.password.inprogress = false;
        }, function(err) {
            if (err.data.errcode == 'M_FORBIDDEN') {
                $scope.password.feedback = "Current password incorrect";
            $scope.password.badfields = [ 'oldpw' ];
            } else {
                $scope.password.feedback = "Failed to change password!";
            }
            $scope.password.state = "error";
            $scope.password.inprogress = false;
        });
    };
}]);
