# WorldSkills AngularJS Utils

## Installation

Install with Bower:

```bash
bower install angular-worldskills-utils --save
```

Load the JavaScript in your HTML file:

```html
<script src="bower_components/angular-worldskills-utils/src/angular-worldskills-utils.js"></script>
```

## Usage

Add the dependency to your AngularJS module:

```javascript
angular.module('yourApp', ['worldskills.utils']);
```

Define the following constants (don't forget to replace your client id):

```javascript
angular.module('yourApp').constant('WORLDSKILLS_CLIENT_ID', '<your client id>');
angular.module('yourApp').constant('WORLDSKILLS_API_AUTH', 'https://api.worldskills.org/auth');
angular.module('yourApp').constant('WORLDSKILLS_AUTHORIZE_URL', 'https://auth.worldskills.org/oauth/authorize');
```

### Authentication

To use any of the following authentication functions, make sure to use the `auth` object in at least one controller, e.g.:

```javascript
angular.module('yourApp').controller('ContainerCtrl', function($scope, auth) {
    $scope.auth = auth;
});

```

### Return to state

To load the previous state after the user has logged in on WorldSkills Auth, you can use `sessionStorage.getItem('redirect_to_state')`.
Configure the `$urlRouterProvider` as following:

```javascript
angular.module('yourApp').config(function($urlRouterProvider) {
    $urlRouterProvider.otherwise(function ($injector, $location) {
        // check for existing redirect
        var $state = $injector.get('$state');
        var redirectToState = sessionStorage.getItem('redirect_to_state');
        var redirectToParams = sessionStorage.getItem('redirect_to_params');
        sessionStorage.removeItem('redirect_to_state');
        sessionStorage.removeItem('redirect_to_params');
        if (redirectToState) {
            if (redirectToParams) {
                redirectToParams = angular.fromJson(redirectToParams);
            } else {
                redirectToParams = {};
            }
            $state.go(redirectToState, redirectToParams);
        } else {
            $state.go('your.home.state');
        }
    });
});
```

### Require authenticated user

To require an authenticated user for certain states, add `requireLoggedIn: true` in the state data:

```javascript
.state('your.state', {
    url: '/your/url',
    templateUrl: 'views/template.html',
    controller: 'YourCtrl',
    data: {
        requireLoggedIn: true
    }
})
```

You can also require specific roles for a state with `requiredRoles`:

```javascript
.state('your.state', {
    url: '/your/url',
    templateUrl: 'views/template.html',
    controller: 'YourCtrl',
    data: {
        requireLoggedIn: true,
        requiredRoles: [
            {code: 100, role: 'Admin'}
        ]
    }
})
```


### Custom fallbacks for forbidden state

Custom fallback in order to handle forbidden redirect manually rather than to redirect to login url automatically.
Add `forbiddenFallbad: function` to `app.js`

```javascript
.state('people', {
  url: '/people?search',
  templateUrl: 'views/people.html',
  controller: 'PersonnelCtrl',
  data:{
    requireLoggedIn: true,        
    forbiddenCallback: function(auth, $state){
      //state passed from $rootScope.$state
      $state.go('person.view', {'pid': auth.user.person_id});          
    },
    requiredRoles: [
      {code: 600, role: APP_ROLES.ADMIN},
      {code: 600, role: APP_ROLES.MANAGER}
    ]
  }
})
```

Also now allows custom fallbacks for login error state, use case: redirect to a signup page instead of auth.loginUrl

```javascript
   .state('restrictedState', {
     url: '/needsLogin',
     templateUrl: 'views/restricted.html',
     controller: 'RestrictedCtrl',     
     data: {
      requireLoggedIn: true,
      forbiddenCallback: function(auth, $state){
        $state.go('signup');
      },
       requiredRoles: [
         {code: 1800, role: APP_ROLES.ADMIN},
         {code: 1800, role: APP_ROLES.MANAGER},
         {code: 1800, role: APP_ROLES.USER}
       ]
     }
   })

   .state('signup', {
    url: '/signup',
    controller: 'SignupCtrl',
    templateUrl: 'views/signup.html',
    data: {
      requireLoggedIn: false
    }
   })
```

### Spinner directive

Show an animated loading indicator graphic.


```html
<ws-spinner ng=show="loading"></ws-spinner>
```

### TextSpinner directive

Show a loading indicator on a button.

```html
<button type="submit" class="btn btn-success">
	Save
	<ws-text-spinner ng-show="loading" class="ng-hide"></ws-text-spinner>
</button>
```

## Spinner sizes

Added small and big versions

```html
<ws-spinner class='bigSpinner'></ws-spinner>
<ws-spinner class='smallSpinner'></ws-spinner>
```
