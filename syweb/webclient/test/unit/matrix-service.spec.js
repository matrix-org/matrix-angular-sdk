describe('MatrixService', function() {
    var scope, timeout, httpBackend;
    var BASE = "http://example.com";
    var PREFIX = "/_matrix/client/api/v1";
    var PREFIX_V2 = "/_matrix/client/v2_alpha";
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
            URL + "/directory/room/" + encodeURIComponent(alias) +
                    "?access_token=foobar")
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
            URL + "/directory/room/" + encodeURIComponent(alias) +
                    "?access_token=foobar")
            .respond({
                room_id: roomId
            });
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
    
    it('should be able to send typing notifications as a different user', inject(
    function(matrixService) {
        var otherUser = "@alice:example.com";
        var testConfig = angular.copy(CONFIG);
        testConfig.user_id = "@bob:example.com";
        matrixService.setConfig(testConfig);
        var roomId = "!fh38hfwfwef:example.com";
        matrixService.setTyping(roomId, true, undefined, otherUser).then(
        function(response) {
            expect(response.data).toEqual({});
        });

        httpBackend.expectPUT(
            URL + "/rooms/" + encodeURIComponent(roomId) + 
            "/typing/"+encodeURIComponent(otherUser) +
            "?access_token=foobar",
            {
                typing: true,
                timeout: matrixService.DEFAULT_TYPING_TIMEOUT_MS
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

    xit('should be able to POST a filter', inject(
    function(matrixService) {
        var testConfig = angular.copy(CONFIG);
        testConfig.user_id = "@bob:example.com";
        matrixService.setConfig(testConfig);
        var filter = {
            types: ["m.*"],
            not_senders: ["@somebot:localhost"]
        };
        var filterResponse = {
            filter_token: "foo"
        };
        matrixService.createFilter(filter).then(function(response) {
            expect(response.data).toEqual(filterResponse);
        });
        httpBackend.expectPOST(BASE+PREFIX_V2+"/user/"+
            encodeURIComponent(testConfig.user_id)+
            "/filter?access_token=foobar",
            filter)
            .respond(filterResponse);
        httpBackend.flush();
    }));

    xit('should be able to GET /rooms/{roomId}/events for scrollback.', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        var roomId = "!foo:bar";
        var fromToken = "e13d14f2#3a424b234#";
        var filterToken = "filterrrrr";
        matrixService.scrollback(roomId, fromToken, filterToken).then(
        function(response) {
            expect(response.data).toEqual({});
        });
        httpBackend.expectGET(URL+"/rooms/"+encodeURIComponent(roomId)+
            "/events?access_token=foobar"+
            "&filter="+encodeURIComponent(filterToken)+
            "&from="+encodeURIComponent(fromToken)+
            "&limit=10"
            )
            .respond({});
        httpBackend.flush();
    }));

    xit('should be able to GET /sync incrementally with a filter.', inject(
    function(matrixService) {
        matrixService.setConfig(CONFIG);
        // Worth noting that if you use '@' then this test will fail because
        // Angular doesn't use encodeURIComponent but uses a looser definition
        // which won't encode @.
        var since = "foo#";
        var filterToken = "e13d14f2#3a424b234#";
        matrixService.sync(since, filterToken).then(function(response) {
            expect(response.data).toEqual({});
        });
        httpBackend.expectGET(URL+"/sync?access_token=foobar"+
            "&filter="+encodeURIComponent(filterToken)+
            "&limit=10"+
            "&since="+encodeURIComponent(since)+
            "&timeout=30000"
            )
            .respond({});
        httpBackend.flush();
    }));
    
    it('should be able to handle rate limiting from the server, if enabled.',
    inject(function(matrixService) {
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
    
    it('should NOT handle rate limiting from the server if not enabled.',
    inject(function(matrixService) {
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
