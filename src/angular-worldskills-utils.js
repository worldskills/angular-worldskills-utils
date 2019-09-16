(function () {
    'use strict';

    var utils = angular.module('worldskills.utils', []);

    utils.service('WorldSkills', function() {
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
                } else if(angular.isArray(obj[key])) {
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

        try {
            var oauthState = sessionStorage.getItem('oauth_state');
            if (!oauthState) {
                // generate new OAuth state
                oauthState = random(32);
                sessionStorage.setItem('oauth_state', oauthState);
            }
        } catch (e) {
            // unable to store OAuth state, don't use it
            oauthState = null;
        }

        // parse access token and state from URL
        var accessToken = params.access_token;
        var state = params.state;
        if (!accessToken) {
            // try to retrieve access token from storage
            accessToken = sessionStorage.getItem('access_token');
        } else {
            // verify state
            if (oauthState !== null && state !== oauthState) {
                // invalid state, clear access token
                accessToken = null;
            } else {
                try {
                    // store access token
                    sessionStorage.setItem('access_token', accessToken);
                } catch (e) {
                    // unable to store access token
                }
            }
        }

        this.$get = ['$rootScope', '$http', '$q', '$interval', '$document', 'WORLDSKILLS_CLIENT_ID', 'WORLDSKILLS_AUTHORIZE_URL', 'WORLDSKILLS_API_AUTH', 'LOAD_CHILD_ENTITY_ROLES', 'FILTER_AUTH_ROLES',
                     function($rootScope, $http, $q, $interval, $document, WORLDSKILLS_CLIENT_ID, WORLDSKILLS_AUTHORIZE_URL, WORLDSKILLS_API_AUTH, LOAD_CHILD_ENTITY_ROLES, FILTER_AUTH_ROLES) {

            var appUrl = window.location.href.replace(window.location.hash, '');

            var auth = {};
            auth.accessToken = accessToken;
            auth.loggedIn = !!auth.accessToken;
            auth.loginUrl = WORLDSKILLS_AUTHORIZE_URL + '?response_type=token&state=' + encodeURIComponent(oauthState) + '&client_id=' + encodeURIComponent(WORLDSKILLS_CLIENT_ID) + '&redirect_uri=' + encodeURIComponent(appUrl);

            auth.refreshRoles = function(){
                var user = auth.getUser();
                auth.user = {};
                auth.user.$promise = user;
                return auth.user.$promise;
            };

            auth.getUser = function(){
            	var queryParam = '?show_child_roles=' + LOAD_CHILD_ENTITY_ROLES;
            	angular.forEach(FILTER_AUTH_ROLES, function(appCode){
            		queryParam += '&app_code=' + appCode;
            	});
                return $http({method: 'GET', url: WORLDSKILLS_API_AUTH + '/users/loggedIn' + queryParam})
                    .success(function(data, status, headers, config) {
                        data.$promise = user;
                        auth.user = data;
                    }).
                    error(function(data, status, headers, config) {
                        // error getting current user, clear access token
                        sessionStorage.removeItem('access_token');
                        auth.accessToken = null;
                        auth.loggedIn = false;
                    });
            };

            auth.hasUserRole = function (applicationCode, roles, entityId) {

                var deferred = $q.defer();

                if (typeof roles == 'string') {
                    roles = [roles];
                }

                auth.user.$promise.then(function () {

                    var hasUserRole = false;

                    angular.forEach(roles, function (role) {

                        angular.forEach(auth.user.roles, function (r) {

                            if (r.role_application.application_code == applicationCode && r.name == role) {

                                if (!r.apply_per_entity || r.ws_entity.id == entityId) {
                                    hasUserRole = true;
                                }
                            }
                        });
                    });

                    deferred.resolve(hasUserRole);
                });

                return deferred.promise;
            };

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

            var user = auth.getUser();

            auth.user = {};
            auth.user.$promise = user;

            $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
                if (typeof toState.data != 'undefined' && !!toState.data.requireLoggedIn) {
                    user.error(function () {

                        //check if custom callback function exists
                        if(typeof toState.data.unAuthenticatedCallback == 'function'){
                            toState.data.unAuthenticatedCallback(auth, $rootScope.$state);
                        } else {
                            try {
                                // error loading loggedIn user, store state
                                sessionStorage.setItem('redirect_to_state', toState.name);
                                sessionStorage.setItem('redirect_to_params', angular.toJson(toParams));
                            } catch (e) {
                                // unable to store state
                            }

                            // redirect to login
                            document.location.href = auth.loginUrl;
                        }
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

            // check if user hasn't been idle for 5 min
            var maxIdleTime = 1000 * 60 * 5;
            var idleTime = 0;
            $interval(function () {
                idleTime += 1000;
            }, 1000);
            $document.on('mousemove keypress', function () {
                idleTime = 0;
            });

            // ping if not idle  
            $interval(function () {
                if (idleTime < maxIdleTime) {
                    $http({method: 'GET', url: WORLDSKILLS_API_AUTH + '/ping'});
                }
            }, maxIdleTime);

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
    
    utils.directive('wsPuppet', function (auth) {
  	  function link(scope, element, attrs) {
  	      scope.$watch(attrs.p, function(val) {
  	        if (val) {
  	          element.show();
  	        }
  	        else {
  	          element.hide();
  	        }
  			  });
  		  }

  		  return {
  	      restrict: 'E',
  	      template: '<div class="puppet-banner">{{auth.user.puppeteer.first_name}} {{auth.user.puppeteer.last_name}} logged in as {{auth.user.first_name}} {{auth.user.last_name}}</div>',
  	      link: link,
  			};
  	  });

    utils.component('wsEntitySelect', {
        template: '<button type="button" class="btn btn-default" ng-click="selectWsEntity()"><span ng-show="selectedEntity">{{selectedEntity.label}}</span><span ng-show="!selectedEntity">Select entity…</span></button>',
        bindings: {
            entity: '=',
            roleApp: '@?',
            role: '@?'
        },
        controller: ['$scope', '$http', '$httpParamSerializer', '$uibModal', 'WORLDSKILLS_API_AUTH', function ($scope, $http, $httpParamSerializer, $uibModal, WORLDSKILLS_API_AUTH) {

            var ctrl = this;
            $scope.entitiesTree = [];
            $scope.entityFilter = {query: ''};
            function parseTree(entity) {
                var node = {label: entity.name.text, children: [], data: entity};
                angular.forEach(entity.children, function (child) {
                    var childNode = parseTree(child);
                    if (childNode !== false) {
                        node.children.push(childNode);
                    }
                });
                if (node.label.toLowerCase().indexOf($scope.entityFilter.query.toLowerCase()) != -1 || node.children.length > 0) {
                    if ($scope.entityFilter.query && node.children.length > 0) {
                        node.expanded = true;
                    }
                    return node;
                } else {
                    return false;
                }
            }
            function createTree() {
                $scope.entitiesTree = [];
                angular.forEach($scope.entities, function (entity) {
                    var node = parseTree(entity);
                    if (node !== false) {
                        $scope.entitiesTree.push(node);
                    }
                });
            }
            var wsEntitiesParams = {};
            wsEntitiesParams.depth = 10;
            wsEntitiesParams.limit = 100000;
            if (ctrl.roleApp) {
                wsEntitiesParams.roleApp = ctrl.roleApp;
            }
            if (ctrl.role) {
                wsEntitiesParams.role = ctrl.role;
            }
            $http({method: 'GET', url: WORLDSKILLS_API_AUTH + '/ws_entities?' + $httpParamSerializer(wsEntitiesParams)}).success(function (data) {
                $scope.entities = data.ws_entity_list;
            });

            $scope.selectedEntity = null;
            $scope.selectEntity = function (entity) {
                ctrl.entity = entity.data.id;
                $scope.selectedEntity = entity;
            };
            $scope.clearEntity = function () {
                ctrl.entity = null;
                $scope.selectedEntity = null;
                $scope.wsEntityModal.close();
            };
            $scope.okEntity = function (entity) {
                $scope.wsEntityModal.close();
            };
            $scope.filterEntityTree = function () {
                createTree();
            };
            $scope.selectWsEntity = function () {
                createTree();
                $scope.wsEntityModal = $uibModal.open({
                    template: '<div class="modal-header"><h3 class="modal-title">Entities</h3></div><div class="modal-body" id="modal-body"><form><div class="form-group"><input type="text" class="form-control" placeholder="Search entity" ng-model="entityFilter.query" ng-change="filterEntityTree()"></div></form><abn-tree tree-data="entitiesTree" icon-leaf="glyphicon glyphicon-triangle-right" expand-level="1" on-select="selectEntity(branch)"></abn-tree></div><div class="modal-footer"><button class="btn btn-danger" type="button" ng-click="clearEntity()">Clear</button><button class="btn btn-primary" type="button" ng-click="okEntity()">OK</button></div>',
                    size: 'md',
                    scope: $scope
                });
            };

        }]

    });

})();
