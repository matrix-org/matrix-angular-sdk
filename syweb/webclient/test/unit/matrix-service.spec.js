describe('MatrixService', function() {
    var scope, timeout, httpBackend;
    var BASE = "http://example.com";
    var PREFIX = "/_matrix/client/api/v1";
    var URL = BASE + PREFIX;
    var roomId = "!wejigf387t34:matrix.org";
    
    var CONFIG = {
        access_token: "foobar",
        homeserver: BASE
    };
    
    beforeEach(module('matrixService'));

    beforeEach(inject(function($rootScope, $httpBackend, $timeout) {
        httpBackend = $httpBackend;
        scope = $rootScope;
        timeout = $timeout;
    }));

    afterEach(function() {
        httpBackend.verifyNoOutstandingExpectation();
        httpBackend.verifyNoOutstandingRequest();
    });

    it('should be able to POST /createRoom with an alias', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var alias = "flibble";
        matrixService.create(alias).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPOST(URL + "/createRoom?access_token=foobar",
            {
                room_alias_name: alias
            })
            .respond({});
        httpBackend.flush();
    }));

    it('should be able to GET /initialSync', inject(function(matrixService) {
        matrixService.setConfig(CONFIG);
        var limit = 15;
        matrixService.initialSync(limit).then(function(response) {
            expect(response.data).toEqual([]);
        });

        httpBackend.expectGET(
            URL + "/initialSync?access_token=foobar&limit=15")
            .respond([]);
        httpBackend.flush();
    }));
    
    it('should be able to GET /rooms/$roomid/state', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        matrixService.roomState(roomId).then(function(response) {
            expect(response.data).toEqual([]);
        });

        httpBackend.expectGET(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/state?access_token=foobar")
            .respond([]);
        httpBackend.flush();
    }));
    
    it('should be able to POST /join', inject(function(matrixService) {
        matrixService.setConfig(CONFIG);
        matrixService.join(roomId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPOST(
            URL + "/join/" + encodeURIComponent(roomId) + 
            "?access_token=foobar",
            {})
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to POST /join/$roomid', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        matrixService.join(roomId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPOST(
            URL + "/join/" + encodeURIComponent(roomId) + 
            "?access_token=foobar",
            {})
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to POST /rooms/$roomid/invite', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var inviteUserId = "@user:example.com";
        matrixService.invite(roomId, inviteUserId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPOST(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/invite?access_token=foobar",
            {
                user_id: inviteUserId
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to POST /rooms/$roomid/leave', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        matrixService.leave(roomId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPOST(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/leave?access_token=foobar",
            {})
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to POST /rooms/$roomid/ban', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@example:example.com";
        var reason = "Because.";
        matrixService.ban(roomId, userId, reason).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPOST(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/ban?access_token=foobar",
            {
                user_id: userId,
                reason: reason
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to GET /directory/room/$alias', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var alias = "#test:example.com";
        var roomId = "!wefuhewfuiw:example.com";
        matrixService.resolveRoomAlias(alias).then(function(response) {
            expect(response.data).toEqual({
                room_id: roomId
            });
        });

        httpBackend.expectGET(
            URL + "/directory/room/" + encodeURIComponent(alias))
            .respond({
                room_id: roomId
            });
        httpBackend.flush();
    }));
    
    it('should be able to send m.room.name', inject(function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var name = "Room Name";
        matrixService.setName(roomId, name).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/state/m.room.name?access_token=foobar",
            {
                name: name
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to send m.room.topic', inject(function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var topic = "A room topic can go here.";
        matrixService.setTopic(roomId, topic).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/state/m.room.topic?access_token=foobar",
            {
                topic: topic
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to send generic state events without a state key', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var eventType = "com.example.events.test";
        var content = {
            testing: "1 2 3"
        };
        matrixService.sendStateEvent(roomId, eventType, content).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + "/state/" + 
            encodeURIComponent(eventType) + "?access_token=foobar",
            content)
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to send generic state events with a state key', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var eventType = "com.example.events.test:special@characters";
        var content = {
            testing: "1 2 3"
        };
        var stateKey = "version:1";
        matrixService.sendStateEvent(roomId, eventType, content, stateKey).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + "/state/" + 
            encodeURIComponent(eventType) + "/" + encodeURIComponent(stateKey)+
            "?access_token=foobar",
            content)
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to PUT generic events ', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var eventType = "com.example.events.test";
        var txnId = "42";
        var content = {
            testing: "1 2 3"
        };
        matrixService.sendEvent(roomId, eventType, txnId, content).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + "/send/" + 
            encodeURIComponent(eventType) + "/" + encodeURIComponent(txnId)+
            "?access_token=foobar",
            content)
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to PUT text messages ', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var body = "ABC 123";
        matrixService.sendTextMessage(roomId, body).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: body,
                msgtype: "m.text"
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to PUT emote messages ', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var body = "ABC 123";
        matrixService.sendEmoteMessage(roomId, body).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: body,
                msgtype: "m.emote"
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to POST redactions', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var eventId = "fwefwexample.com";
        matrixService.redactEvent(roomId, eventId).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPOST(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/redact/" + encodeURIComponent(eventId) +
            "?access_token=foobar")
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to paginate a room', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!wefuhewfuiw:example.com";
        var from = "3t_44e_54z";
        var limit = 20;
        matrixService.paginateBackMessages(roomId, from, limit).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectGET(
            URL + "/rooms/" + encodeURIComponent(roomId) +
                    "/messages?access_token=foobar&dir=b&from="+
                    encodeURIComponent(from)+"&limit="+limit)
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to GET /publicRooms', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        matrixService.publicRooms().then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectGET(
            new RegExp(URL + "/publicRooms(.*)"))
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to GET /profile/$userid/displayname', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@foo:example.com";
        matrixService.getDisplayName(userId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectGET(URL + "/profile/" + encodeURIComponent(userId) +
            "/displayname?access_token=foobar")
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to GET /profile/$userid/avatar_url', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@foo:example.com";
        matrixService.getProfilePictureUrl(userId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectGET(URL + "/profile/" + encodeURIComponent(userId) +
            "/avatar_url?access_token=foobar")
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to PUT /profile/$me/avatar_url', inject(
    function(matrixService) {
        var testConfig = angular.copy(CONFIG);
        testConfig.user_id = "@bob:example.com";
        matrixService.setConfig(testConfig);
        var url = "http://example.com/mypic.jpg";
        matrixService.setProfilePictureUrl(url).then(function(response) {
            expect(response.data).toEqual({});
        });
        httpBackend.expectPUT(URL + "/profile/" + 
            encodeURIComponent(testConfig.user_id) +
            "/avatar_url?access_token=foobar",
            {
                avatar_url: url
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to PUT /profile/$me/displayname', inject(
    function(matrixService) {
        var testConfig = angular.copy(CONFIG);
        testConfig.user_id = "@bob:example.com";
        matrixService.setConfig(testConfig);
        var displayname = "Bob Smith";
        matrixService.setDisplayName(displayname).then(function(response) {
            expect(response.data).toEqual({});
        });
        httpBackend.expectPUT(URL + "/profile/" + 
            encodeURIComponent(testConfig.user_id) +
            "/displayname?access_token=foobar",
            {
                displayname: displayname
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to send typing notifications', inject(
    function(matrixService) {
        var testConfig = angular.copy(CONFIG);
        testConfig.user_id = "@bob:example.com";
        matrixService.setConfig(testConfig);
        var roomId = "!fh38hfwfwef:example.com";
        matrixService.setTyping(roomId, true).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/typing/"+encodeURIComponent(testConfig.user_id) +
            "?access_token=foobar",
            {
                typing: true,
                timeout: matrixService.DEFAULT_TYPING_TIMEOUT_MS
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to send typing notifications with a custom timeout', inject(
    function(matrixService) {
        var testConfig = angular.copy(CONFIG);
        testConfig.user_id = "@bob:example.com";
        matrixService.setConfig(testConfig);
        var roomId = "!fh38hfwfwef:example.com";
        matrixService.setTyping(roomId, true, 15000).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/typing/"+encodeURIComponent(testConfig.user_id) +
            "?access_token=foobar",
            {
                typing: true,
                timeout: 15000
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to stop sending typing notifications', inject(
    function(matrixService) {
        var testConfig = angular.copy(CONFIG);
        testConfig.user_id = "@bob:example.com";
        matrixService.setConfig(testConfig);
        var roomId = "!fh38hfwfwef:example.com";
        matrixService.setTyping(roomId, false).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/typing/"+encodeURIComponent(testConfig.user_id) +
            "?access_token=foobar",
            {
                typing: false
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to login with password', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@bob:example.com";
        var password = "monkey";
        matrixService.login(userId, password).then(function(response) {
            expect(response.data).toEqual({});
        });
        httpBackend.expectPOST(new RegExp(URL+"/login(.*)"),
            {
                user: userId,
                password: password,
                type: "m.login.password"
            })
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to GET another user's profile info", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@foo:example.com";
        matrixService.getProfile(userId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectGET(URL + "/profile/" + encodeURIComponent(userId) +
            "?access_token=foobar")
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to send HTML messages", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var body = "ABC 123";
        var html = "<p><b>ABC</b> 123</p>";
        matrixService.sendHtmlMessage(roomId, body, html).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: body,
                format: "org.matrix.custom.html",
                formatted_body: html,
                msgtype: "m.text"
            })
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to send image messages", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var url = "mxc://some/uri";
        var info = {
            w: 100,
            h: 200,
            mimetype: "image/gif"
        };
        matrixService.sendImageMessage(roomId, url, info).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: "Image",
                info: info,
                url: url,
                msgtype: "m.image"
            })
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to send generic messages", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!fh38hfwfwef:example.com";
        var content = {
            body: "default fall back string",
            custom: "weeee",
            stuff: 42,
            msgtype: "org.custom.type"
        }
        matrixService.sendMessage(roomId, undefined, content).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            content)
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to kick a user without a reason", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@example:example.com";
        matrixService.kick(roomId, userId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/state/m.room.member/"+encodeURIComponent(userId)+"?access_token=foobar",
            {
                membership: "leave",
            })
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to kick a user with a reason", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@example:example.com";
        var reason = "Because I say so";
        matrixService.kick(roomId, userId, reason).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/state/m.room.member/"+encodeURIComponent(userId)+"?access_token=foobar",
            {
                membership: "leave",
                reason: reason
            })
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to unban a user", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@example:example.com";
        matrixService.unban(roomId, userId).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/state/m.room.member/"+encodeURIComponent(userId)+"?access_token=foobar",
            {
                membership: "leave",
            })
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to GET the event stream", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var from = "s33_44_55_66";
        var serverTimeout = 124567;
        matrixService.getEventStream(from, serverTimeout).then(function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectGET(
            URL + "/events?access_token=foobar&from="+from+"&timeout="+serverTimeout)
            .respond({});
        httpBackend.flush();
    }));

    it("should be able to GET room initial sync", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var limit = 15;
        var roomId = "!flibble:wibble";
        matrixService.roomInitialSync(roomId, limit).then(function(response) {
            expect(response.data).toEqual([]);
        });

        httpBackend.expectGET(
            URL + "/rooms/"+encodeURIComponent(roomId)+
            "/initialSync?access_token=foobar&limit=15")
            .respond([]);
        httpBackend.flush();
    }));

    it("should be able to PUT new power levels from an existing event", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@foo:bar";
        var roomId = "!flibble:wibble";
        var level = 42;
        var event = {
            type: "m.room.power_levels",
            content: {
              "ban": 50,
              "events": {
                "m.room.name": 100,
                "m.room.power_levels": 100
              },
              "events_default": 0,
              "kick": 50,
              "redact": 50,
              "state_default": 50,
              "users": {
                "@woo:hoo": 100
              },
              "users_default": 0
            }
        };
        var newContent = angular.copy(event.content);
        newContent.users[userId] = level;
        matrixService.setUserPowerLevel(roomId, userId, level, event).then(function(response) {
            expect(response.data).toEqual([]);
        });

        httpBackend.expectPUT(
            URL + "/rooms/"+encodeURIComponent(roomId)+
            "/state/m.room.power_levels?access_token=foobar",
            newContent)
            .respond([]);
        httpBackend.flush();
    }));

    it("should be able to PUT new power levels", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var userId = "@foo:bar";
        var roomId = "!flibble:wibble";
        var level = 42;
        var newContent = {
            users: {}
        };
        newContent.users[userId] = level;
        matrixService.setUserPowerLevel(roomId, userId, level).then(function(response) {
            expect(response.data).toEqual([]);
        });

        httpBackend.expectPUT(
            URL + "/rooms/"+encodeURIComponent(roomId)+
            "/state/m.room.power_levels?access_token=foobar",
            newContent)
            .respond([]);
        httpBackend.flush();
    }));

    it("should be able to get identicon URIs", inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var id = "@foo:bar";
        var uri = matrixService.getIdenticonUri(id, 32, 64);
        expect(uri).toEqual(CONFIG.homeserver+"/_matrix/media/v1/identicon/"+
            encodeURIComponent(id)+"?width=32&height=64");
    }));

    it("should be able to get HTTP URIs for MXC URIs", inject(
    function(matrixService) {
        // TODO getHttpUriForMxc
    }));

    it("should be able to get HTTP URIs for MXC URIs with fragments", inject(
    function(matrixService) {
        // TODO getHttpUriForMxc
    }));

    it("should be able to get HTTP URIs for MXC URIs with query params", inject(
    function(matrixService) {
        // TODO getHttpUriForMxc
    }));

    it("should be able to get HTTP URIs for MXC URIs with query params and fragments", inject(
    function(matrixService) {
        // TODO getHttpUriForMxc
    }));
    
    it('should be able to PUT presence status', inject(
    function(matrixService) {
        var testConfig = angular.copy(CONFIG);
        testConfig.user_id = "@bob:example.com";
        matrixService.setConfig(testConfig);
        var status = "unavailable";
        matrixService.setUserPresence(status).then(function(response) {
            expect(response.data).toEqual({});
        });
        httpBackend.expectPUT(URL+"/presence/"+
            encodeURIComponent(testConfig.user_id)+
            "/status?access_token=foobar",
            {
                presence: status
            })
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to handle rate limiting from the server, if enabled.', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        matrixService.shouldHandleRateLimiting(true);
        var roomId = "!fh38hfwfwef:example.com";
        var body = "ABC 123";
        var successResponse = undefined;
        var errorResponse = undefined;
        matrixService.sendTextMessage(roomId, body).then(function(suc){
            successResponse = suc;
        }, function(err) {
            errorResponse = err;
        });

        var retryTime = 2942;
        var errMsg = {
            error: "You've been rate limited.",
            errcode: "M_LIMIT_EXCEEDED",
            retry_after_ms: retryTime
        };
        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: body,
                msgtype: "m.text"
            })
            .respond(429, errMsg);
        httpBackend.flush();
        
        expect(errorResponse).toBeUndefined(); // shouldn't have failed yet.  
        
        
        var success = {
            event_id: "foo"
        };
        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: body,
                msgtype: "m.text"
            })
            .respond(success);
            
        timeout.flush(); // expires all timers
        httpBackend.flush(); // checks the request was made
        
        expect(successResponse).toBeDefined();
        expect(successResponse.data).toEqual(success);
        
    }));
    
    it('should NOT handle rate limiting from the server if not enabled.', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        matrixService.shouldHandleRateLimiting(false);
        var roomId = "!fh38hfwfwef:example.com";
        var body = "ABC 123";
        var errorResponse = undefined;
        matrixService.sendTextMessage(roomId, body).then(function(){}, function(err) {
            errorResponse = err;
        });

        var errMsg = {
            error: "You've been rate limited.",
            errcode: "M_LIMIT_EXCEEDED",
            retry_after_ms: 2942
        };
        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: body,
                msgtype: "m.text"
            })
            .respond(429, errMsg);
        httpBackend.flush();
        expect(errorResponse).toBeDefined();
        expect(errorResponse.data).toEqual(errMsg);
    }));
    
    it('should give up retrying rate limits based on giveUpRateLimitRetryAfter.', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        matrixService.shouldHandleRateLimiting(true);
        matrixService.giveUpRateLimitRetryAfter(5000); // 5sec
        var roomId = "!fh38hfwfwef:example.com";
        var body = "ABC 123";
        var successResponse = undefined;
        var errorResponse = undefined;
        matrixService.sendTextMessage(roomId, body).then(function(suc){
            successResponse = suc;
        }, function(err) {
            errorResponse = err;
        });

        var retryTime = 5942;
        var errMsg = {
            error: "You've been rate limited.",
            errcode: "M_LIMIT_EXCEEDED",
            retry_after_ms: retryTime
        };
        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: body,
                msgtype: "m.text"
            })
            .respond(429, errMsg);
        httpBackend.flush();
        
        expect(errorResponse).toBeUndefined(); // shouldn't have failed yet.  
        
        
        // rate limit again
        httpBackend.expectPUT(
            new RegExp(URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/send/m.room.message/(.*)" +
            "?access_token=foobar"),
            {
                body: body,
                msgtype: "m.text"
            })
            .respond(429, errMsg);
            
        timeout.flush(); // expires all timers
        httpBackend.flush(); // checks the request was made
        
        // should've given up.
        expect(errorResponse).toBeDefined();
        expect(errorResponse.data).toEqual(errMsg);
        
    }));
});
