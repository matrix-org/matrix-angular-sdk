describe('WebtRTCService', function() {
    var $q, $timeout, $rootScope;
    
    // dependencies
    var win;

    beforeEach(function() {
        // mocked dependencies
        module(function ($provide) {
            $provide.value('$window', win);
        });
        
        win = {
            navigator: {
            
            }
        };
        
        // tested service
        module('webRtcService');
    });
    
    beforeEach(inject(function(_$q_, _$timeout_, _$rootScope_) {
        $q = _$q_;
        $timeout = _$timeout_;
        $rootScope = _$rootScope_;
    }));
    
    it('should work with webkit WebRTC.', inject(
    function(webRtcService) {
        win.navigator.webkitGetUserMedia = function(){};
        win.webkitRTCPeerConnection = function(){};
        win.webkitRTCSessionDescription = function(){};
        win.webkitRTCIceCandidate = function(){};
    
        webRtcService.init();
        expect(webRtcService.isWebRTCSupported()).toBe(true);
    }));
    
    it('should work with moz WebRTC.', inject(
    function(webRtcService) {
        win.navigator.mozGetUserMedia = function(){};
        win.mozRTCPeerConnection = function(){};
        win.mozRTCSessionDescription = function(){};
        win.mozRTCIceCandidate = function(){};
    
        webRtcService.init();
        expect(webRtcService.isWebRTCSupported()).toBe(true);
    }));
    
    it('should work with native WebRTC.', inject(
    function(webRtcService) {
        win.navigator.getUserMedia = function(){};
        win.RTCPeerConnection = function(){};
        win.RTCSessionDescription = function(){};
        win.RTCIceCandidate = function(){};
    
        webRtcService.init();
        expect(webRtcService.isWebRTCSupported()).toBe(true);
    }));
    
    it('should not work if there are no webrtc functions.', inject(
    function(webRtcService) {
        webRtcService.init();
        expect(webRtcService.isWebRTCSupported()).toBe(false);
    }));
    
    it('should not work if there are partial webrtc functions.', inject(
    function(webRtcService) {
        win.navigator.getUserMedia = function(){};
        win.RTCPeerConnection = function(){};
        
        webRtcService.init();
        expect(webRtcService.isWebRTCSupported()).toBe(false);
    }));
    
    it('should determine if OpenWebRTC is being used based on owr.js existing.', inject(
    function(webRtcService) {
        var fn = angular.element;
        var scripts = [{src:"lib/something.js"}, {src:"lib/webrtc/owr.js"}, {src:"other.js"}];
        spyOn(angular, "element").and.callFake(function(ele) {
            if (ele === "script") {
                return scripts;
            }
        });
        expect(webRtcService.isOpenWebRTC()).toBe(true);
        
        scripts = [{src:"lib/something.js"}, {src:"other.js"}];
        expect(webRtcService.isOpenWebRTC()).toBe(false);
        angular.element = fn;
    }));
    
    it('should pass through new IceCandidate.', inject(
    function(webRtcService) {
        win.navigator.getUserMedia = function(){};
        win.RTCPeerConnection = function(){};
        win.RTCSessionDescription = function(){};
        win.RTCIceCandidate = function(){};
        spyOn(win, "RTCIceCandidate");
        var input = {
            some: "thing"
        };
        
        webRtcService.init();
        webRtcService.newIceCandidate(input);
        expect(win.RTCIceCandidate).toHaveBeenCalledWith(input);
    }));
    
    it('should pass through new RTCSessionDescription.', inject(
    function(webRtcService) {
        win.navigator.getUserMedia = function(){};
        win.RTCPeerConnection = function(){};
        win.RTCSessionDescription = function(){};
        win.RTCIceCandidate = function(){};
        spyOn(win, "RTCSessionDescription");
        var input = {
            some: "thing"
        };
        
        webRtcService.init();
        webRtcService.newRTCSessionDescription(input);
        expect(win.RTCSessionDescription).toHaveBeenCalledWith(input);
    }));
    
    it("should resolve the deferred when getUserMedia's success fn is called.", inject(
    function(webRtcService) {
        win.navigator.getUserMedia = function(){};
        win.RTCPeerConnection = function(){};
        win.RTCSessionDescription = function(){};
        win.RTCIceCandidate = function(){};
        var output = {
            some: "thing"
        };
        spyOn(win.navigator, "getUserMedia").and.callFake(function(constraint, suc, fail) {
            suc(output);
        });
        
        webRtcService.init();
        
        var response;
        webRtcService.getUserMedia("constraints").then(function(s) {
            response = s;
        });
        $rootScope.$digest();
        
        expect(response).toEqual(output);
    }));
    
    it("should reject the deferred when getUserMedia's fail fn is called.", inject(
    function(webRtcService) {
        win.navigator.getUserMedia = function(){};
        win.RTCPeerConnection = function(){};
        win.RTCSessionDescription = function(){};
        win.RTCIceCandidate = function(){};
        var output = {
            some: "thing"
        };
        spyOn(win.navigator, "getUserMedia").and.callFake(function(constraint, suc, fail) {
            fail(output);
        });
        
        webRtcService.init();
        
        var response;
        webRtcService.getUserMedia("constraints").then(function(s){}, function(e) {
            response = e;
        });
        $rootScope.$digest();
        
        expect(response).toEqual(output);
    }));
    
    it("createPeerConnection should use the fallback turn server if no turn servers are specified.", inject(
    function(webRtcService) {
        win.navigator.getUserMedia = function(){};
        win.RTCPeerConnection = function(){};
        win.RTCSessionDescription = function(){};
        win.RTCIceCandidate = function(){};
        spyOn(win, "RTCPeerConnection");
        
        webRtcService.FALLBACK_STUN_SERVER = "fallback";
        webRtcService.init();
        webRtcService.createPeerConnection({});
        
        expect(win.RTCPeerConnection).toHaveBeenCalledWith({
            "iceServers":[{urls: "fallback"}]
        });
    }));
    
    it("createPeerConnection should use the turn servers specified.", inject(
    function(webRtcService) {
        win.navigator.getUserMedia = function(){};
        win.RTCPeerConnection = function(){};
        win.RTCSessionDescription = function(){};
        win.RTCIceCandidate = function(){};
        spyOn(win, "RTCPeerConnection");
        
        var input = {
            uris: ["aaa", "bbb", "ccc"],
            username: "user",
            password: "pass"
        };
        
        webRtcService.init();
        webRtcService.createPeerConnection(input);
        
        var output = {
            urls: ["aaa", "bbb", "ccc"],
            username: "user",
            credential: "pass"
        };
        
        expect(win.RTCPeerConnection).toHaveBeenCalledWith({
            "iceServers":[output]
        });
    }));
    
    it("createPeerConnection should map mozRTCPeerConnection into separate url Objects correctly.", inject(
    function(webRtcService) {
        win.navigator.mozGetUserMedia = function(){};
        win.mozRTCPeerConnection = function(){};
        win.mozRTCSessionDescription = function(){};
        win.mozRTCIceCandidate = function(){};
        spyOn(win, "mozRTCPeerConnection");
        
        var input = {
            uris: ["aaa", "bbb", "ccc"],
            username: "user",
            password: "pass"
        };
        
        webRtcService.init();
        webRtcService.createPeerConnection(input);
        
        var output = [
        {
            url: "aaa",
            username: "user",
            credential: "pass"
        },
        {
            url: "bbb",
            username: "user",
            credential: "pass"
        },
        {
            url: "ccc",
            username: "user",
            credential: "pass"
        }
        ];
        
        expect(win.mozRTCPeerConnection).toHaveBeenCalledWith({
            "iceServers":output
        });
    }));
});
