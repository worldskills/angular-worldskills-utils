(function () {
    'use strict';

    var utils = angular.module('worldskills.utils', []);

    utils.service('WorldSkills', function($resource) {
        return {
            getLink: function(links, rel) {
                var href;
                angular.forEach(links, function(link) {
                    if (link.rel == rel) {
                        href = link.href;
                    }
                });
                return href;
            }
        };
    });

    utils.provider('auth', function () {

        /**
         * Copied from angular.js
         *
         * Tries to decode the URI component without throwing an exception.
         *
         * @private
         * @param str value potential URI component to check.
         * @returns {boolean} True if `value` can be decoded
         * with the decodeURIComponent function.
         */
        function tryDecodeURIComponent(value) {
          try {
            return decodeURIComponent(value);
          } catch(e) {
            // Ignore any invalid uri component
          }
        }

        /**
         * Copied from angular.js
         *
         * Parses an escaped url query string into key-value pairs.
         *
         * @returns Object.<(string|boolean)>
         */
        function parseKeyValue(/**string*/keyValue) {
          var obj = {}, key_value, key;
          angular.forEach((keyValue || "").split('&'), function(keyValue){
            if ( keyValue ) {
              key_value = keyValue.split('=');
              key = tryDecodeURIComponent(key_value[0]);
              if ( angular.isDefined(key) ) {
                var val = angular.isDefined(key_value[1]) ? tryDecodeURIComponent(key_value[1]) : true;
                if (!obj[key]) {
                  obj[key] = val;
                } else if(isArray(obj[key])) {
                  obj[key].push(val);
                } else {
                  obj[key] = [obj[key],val];
                }
              }
            }
          });
          return obj;
        }

        function random(length) {
            var result = '', chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            for (var i = length; i > 0; --i) {
                result += chars[Math.round(Math.random() * (chars.length - 1))];
            }
            return result;
        }

        var params = parseKeyValue(window.location.hash.substr(1));

        var oauthState = sessionStorage.getItem('oauth_state');
        if (!oauthState) {
            // generate new OAuth state
            oauthState = random(32);
            sessionStorage.setItem('oauth_state', oauthState);
        }

        // parse access token and state from URL
        var accessToken = params.access_token;
        var state = params.state;
        if (!accessToken) {
            // try to retrive access token from storage
            accessToken = sessionStorage.getItem('access_token');
        } else {
            // verify state
            if (state != oauthState) {
                // invalid state, clear access token
                accessToken = null;
            } else {
                // store access token
                sessionStorage.setItem('access_token', accessToken);
            }
        }

        this.$get = ['$rootScope', '$http', 'WORLDSKILLS_CLIENT_ID', 'WORLDSKILLS_AUTHORIZE_URL', 'WORLDSKILLS_API_AUTH', function($rootScope, $http, WORLDSKILLS_CLIENT_ID, WORLDSKILLS_AUTHORIZE_URL, WORLDSKILLS_API_AUTH) {

            var appUrl = window.location.href.replace(window.location.hash, '');

            var auth = {};
            auth.accessToken = accessToken;
            auth.loggedIn = !!auth.accessToken;
            auth.loginUrl = WORLDSKILLS_AUTHORIZE_URL + '?response_type=token&state=' + encodeURIComponent(oauthState) + '&client_id=' + encodeURIComponent(WORLDSKILLS_CLIENT_ID) + '&redirect_uri=' + encodeURIComponent(appUrl);

            auth.logout = function () {

                var reloadPage = function () {

                    // reload page
                    document.location.href = appUrl;
                };

                // delete access token and OAuth state
                sessionStorage.removeItem('access_token');
                sessionStorage.removeItem('oauth_state');

                // destroy session
                $http({method: 'POST', url: WORLDSKILLS_API_AUTH + '/sessions/logout'})
                    .success(reloadPage)
                    .error(reloadPage);
            };

            // add access token header
            if (auth.loggedIn) {
                $http.defaults.headers.common.Authorization = 'Bearer ' + auth.accessToken;
            }

            var user = $http({method: 'GET', url: WORLDSKILLS_API_AUTH + '/users/loggedIn'})
                .success(function(data, status, headers, config) {
                    auth.user = data;
                }).
                error(function(data, status, headers, config) {
                    // error getting current user, clear access token
                    sessionStorage.removeItem('access_token');
                    auth.accessToken = null;
                    auth.loggedIn = false;
                });

            $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
                if (typeof toState.data != 'undefined' && !!toState.data.requireLoggedIn) {
                    user.error(function () {

                        // error loading loggedIn user, store state
                        sessionStorage.setItem('redirect_to_state', toState.name);
                        sessionStorage.setItem('redirect_to_params', angular.toJson(toParams));

                        // redirect to login
                        document.location.href = auth.loginUrl;
                    });
                }
                if (typeof toState.data != 'undefined' && !!toState.data.requiredRoles && toState.data.requiredRoles.length > 0) {                    

                    //check for roles
                    user.success(function(data, status, headers, config) {

                        var hasRole = false;
                        angular.forEach(toState.data.requiredRoles, function (requiredRole) {
                            angular.forEach(data.roles, function (role) {
                                if (role.role_application.application_code == requiredRole.code && role.name == requiredRole.role) {
                                    hasRole = true;
                                }
                            });
                        });
                        if (!hasRole){
                            if(typeof toState.data.forbiddenCallback == 'function'){
                                toState.data.forbiddenCallback(auth, $rootScope.$state);
                            }
                            else{
                                alert("You do not have the required role to access this view. Redirecting to login page.");
                                document.location.href = auth.loginUrl;
                            }
                        }
                    });
                }
            });

            return auth;
        }];
    });

    utils.directive('wsSpinner', function () {
        return {
          template: '<div class="spinner"><div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div></div>',
          restrict: 'E'      
        };
    });

    utils.directive('wsTextSpinner', function($interval) {
        return {
            restrict: 'E',
            link: function(scope, element, attrs) {
                var i = 0;
                $interval(function () {
                    i = (i + 1) % 4;
                    var loading = '';
                    for (var j = 0; j < 3; j++) {
                        if (j < i) {
                            loading += '.';
                        } else {
                            loading += '&nbsp;';
                        }
                    }
                    element.html(loading);
                }, 300);
            }
        };
    });

})();
