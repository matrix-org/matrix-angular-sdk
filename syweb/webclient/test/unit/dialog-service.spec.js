describe('DialogService', function() {
    var q;
    
    // mocked dependency
    var dialogs = {
        error: function(title, body){
        
        },
        notify: function(title, body){
        
        }
    };
    
    beforeEach(function() {
        module(function ($provide) {
            $provide.value('dialogs', dialogs);
        });
        module('dialogService');
    });
    
    beforeEach(inject(function($q) {
        q = $q;
    }));
    
    it('should display a "Network Error" for a failed HTTP request (no connection).', inject(
    function(dialogService) {
        var err = {
            status: 0,
            data: {}
        };
        spyOn(dialogs, "error");
        dialogService.showError(err);
        expect(dialogs.error).toHaveBeenCalledWith("Network Error", jasmine.any(String));
    }));
    
    it('should display an "HTTP Error" for a failed HTTP request (non 2xx response).', inject(
    function(dialogService) {
        var err = {
            status: 404,
            data: {}
        };
        spyOn(dialogs, "error");
        dialogService.showError(err);
        expect(dialogs.error).toHaveBeenCalledWith("HTTP Error", jasmine.any(String));
    }));
    
    it('should display the value of the HS "error" and "errcode" if one is provided.', inject(
    function(dialogService) {
        var errcode = "M_SOMETHING";
        var error = "A message is you";
        var err = {
            status: 200,
            data: {
                errcode: errcode,
                error: error
            }
        };
        spyOn(dialogs, "error");
        dialogService.showError(err);
        expect(dialogs.error).toHaveBeenCalled();
        var args = dialogs.error.calls.argsFor(0);
        var errcodeExists = args[0].indexOf(errcode) >= 0 || args[1].indexOf(errcode) >= 0;
        var errorExists = args[0].indexOf(error) >= 0 || args[1].indexOf(error) >= 0;
        expect(errorExists).toBe(true);
        expect(errcodeExists).toBe(true);
    }));
    
    it('should be able to display errors for just data responses.', inject(
    function(dialogService) {
        var errcode = "M_SOMETHING";
        var error = "A message is you";
        var err = {
            errcode: errcode,
            error: error
        };
        spyOn(dialogs, "error");
        dialogService.showError(err);
        expect(dialogs.error).toHaveBeenCalled();
        var args = dialogs.error.calls.argsFor(0);
        var errcodeExists = args[0].indexOf(errcode) >= 0 || args[1].indexOf(errcode) >= 0;
        var errorExists = args[0].indexOf(error) >= 0 || args[1].indexOf(error) >= 0;
        expect(errorExists).toBe(true);
        expect(errcodeExists).toBe(true);
    }));
    
    it('should display success messages.', inject(
    function(dialogService) {
        var title = "title";
        var body = "A body";
        spyOn(dialogs, "notify");
        dialogService.showSuccess(title, body);
        expect(dialogs.notify).toHaveBeenCalledWith(title, body);
    }));
    
    it('should display raw error strings.', inject(
    function(dialogService) {
        var body = "A body is you";
        spyOn(dialogs, "error");
        dialogService.showError(body);
        expect(dialogs.error).toHaveBeenCalledWith(jasmine.any(String), body);
    }));
    
    it('should escape HTML in the error.', inject(
    function(dialogService) {
        var body = "<html>bar</html>";
        var escapedBody = "&lt;html&gt;bar&lt;/html&gt;"
        spyOn(dialogs, "error");
        dialogService.showError(body);
        expect(dialogs.error).toHaveBeenCalledWith(jasmine.any(String), escapedBody);
    }));
});
