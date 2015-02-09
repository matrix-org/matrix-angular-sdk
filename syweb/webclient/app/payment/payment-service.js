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

/*
This service controls when events are removed from the modelService in order to
control memory usage.
*/
angular.module('paymentService', [])
.factory('paymentService', [ '$http', 
function($http) {
	// TODO: Extract cancel/return URLs and user/pwd/signature
	var payPal = {
		credentials: {
			user: "API_USERNAME",
			password: "API_PWD",
			signature: "API_SIG"
		},
		client: {
			returnUrl: "http://localhost:8000#return",
			cancelUrl: "http://localhost:8000#cancel"
		}
	};

	return {
		setExpressCheckout: function(amount) {
			var formData = {
				USER: payPal.credentials.user,
				PWD: payPal.credentials.password,
				SIGNATURE: payPal.credentials.signature,
				VERSION: "xx.0",
				PAYMENTREQUEST_0_PAYMENTACTION: "Sale",
				PAYMENTREQUEST_0_AMT: amount,
				RETURNURL: payPal.client.returnUrl,
				CANCELURL: payPal.client.cancelUrl,
				METHOD: "SetExpressCheckout"
			};

			return $http({
				method: "POST",
				url: "https://api-3t.sandbox.paypal.com/nvp",
				data: $.param(formData),
				headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
			});
		}
	};
}]);