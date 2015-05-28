describe('TypingService', function() {
    var $interval, $q, $rootScope;

    var matrixService = {
        setTyping: function(){}
    };

    beforeEach(function() {
        module(function ($provide) {
            $provide.value('matrixService', matrixService);
        });
        module('typingService');
    });
    
    beforeEach(inject(function(_$interval_, _$q_, _$rootScope_) {
        $interval = _$interval_;
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));
    
    it('should be able to start sending typing notifications.', inject(
    function(typingService) {
        var roomId = "!foo:bar";
        var defer = $q.defer();
        spyOn(matrixService, "setTyping").and.returnValue(defer.promise);
    
        typingService.setTyping(roomId, true);
        expect(matrixService.setTyping).toHaveBeenCalledWith(roomId, true, typingService.SERVER_SPECIFIED_TIMEOUT_MS);
    }));
    
    it('should be able to explicitly stop sending typing notifications.', inject(
    function(typingService) {
        var roomId = "!foo:bar";
        var defer = $q.defer();
        spyOn(matrixService, "setTyping").and.returnValue(defer.promise);
    
        typingService.setTyping(roomId, true);
        defer.resolve({});
        $rootScope.$digest();
        
        typingService.setTyping(roomId, false);
        expect(matrixService.setTyping).toHaveBeenCalledWith(roomId, false);
    }));
    
    it('should timeout and send a stop typing notification if it expires.', inject(
    function(typingService) {
        var roomId = "!foo:bar";
        var defer = $q.defer();
        spyOn(matrixService, "setTyping").and.returnValue(defer.promise);
    
        typingService.setTyping(roomId, true);
        defer.resolve({});
        $rootScope.$digest();
        
        $interval.flush(typingService.USER_TIMEOUT_MS); // annoyingly this flushes ALL THE TIMEOUTS :(
        
        expect(matrixService.setTyping).toHaveBeenCalledWith(roomId, false);
    }));
});
