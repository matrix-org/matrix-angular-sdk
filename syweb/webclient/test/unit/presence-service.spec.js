describe('PresenceService', function() {
    var $q, $timeout;
    
    var matrixService = {
        setUserPresence: function(state){},
        presence: {
            unavailable: "unavailable",
            offline: "offline",
            online: "online"
        }
    };
    
    var doc = [{
        onmousemove: null,
        onkeypress: null
    }];

    beforeEach(function() {
        // mocked dependencies
        module(function ($provide) {
            $provide.value('matrixService', matrixService);
            $provide.value('$document', doc);
        });
        
        // tested service
        module('mPresence');
    });
    
    beforeEach(inject(function(_$q_, _$timeout_) {
            $q = _$q_;
            $timeout = _$timeout_;
    }));
    
    it('should start with the user as online.', inject(
    function(mPresence) {
        var defer = $q.defer();
        spyOn(matrixService, "setUserPresence").and.returnValue(defer.promise);
        mPresence.start();
        expect(matrixService.setUserPresence).toHaveBeenCalledWith(
            matrixService.presence.online
        );
    }));
    
    it('should timeout and set the user as unavailable.', inject(
    function(mPresence) {
        var defer = $q.defer();
        spyOn(matrixService, "setUserPresence").and.returnValue(defer.promise);
        mPresence.start();
        defer.resolve({});
        $timeout.flush(); // expire the timer
        expect(matrixService.setUserPresence).toHaveBeenCalledWith(
            matrixService.presence.unavailable
        );
    }));
    
    it('should stop monitoring if stop() is called.', inject(
    function(mPresence) {
        var defer = $q.defer();
        spyOn(matrixService, "setUserPresence").and.returnValue(defer.promise);
        mPresence.start();
        defer.resolve({});
        
        mPresence.stop();
        
        $timeout.flush(); // expire the timer
        expect(matrixService.setUserPresence).not.toHaveBeenCalledWith(
            matrixService.presence.unavailable
        );
    }));
    
    it('should be able to get the current presence state via getState().', inject(
    function(mPresence) {
        var defer = $q.defer();
        spyOn(matrixService, "setUserPresence").and.returnValue(defer.promise);
        mPresence.start();
        defer.resolve({});
        expect(mPresence.getState()).toEqual(matrixService.presence.online);
        
        $timeout.flush(); // expire the timer
        expect(mPresence.getState()).toEqual(matrixService.presence.unavailable);
    }));
    
    it('should go online when the mouse is moved.', inject(
    function(mPresence) {
        var defer = $q.defer();
        spyOn(matrixService, "setUserPresence").and.returnValue(defer.promise);
        mPresence.start();
        defer.resolve({}); // online
        $timeout.flush(); // expire the timer
        expect(mPresence.getState()).toEqual(matrixService.presence.unavailable);
        
        doc[0].onmousemove();
        
        expect(mPresence.getState()).toEqual(matrixService.presence.online);
        expect(matrixService.setUserPresence).toHaveBeenCalledWith(
            matrixService.presence.online
        );
    }));
    
});
