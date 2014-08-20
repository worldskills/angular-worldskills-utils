# WorldSkills AngularJS Utils

## Installation

Install with Bower:

```
bower install angular-worldskills-utils --save
```

Load the JavaScript in your HTML file:

```
<script src="bower_components/angular-worldskills-utils/src/angular-worldskills-utils.js"></script>
```

## Usage

Add the dependency to your AngularJS module:

```
angular.module('yourApp', ['worldskills.utils']);
```

Define the following constants (don't forget to replace your client id):

```
angular.module('yourApp').constant('WORLDSKILLS_CLIENT_ID', '<your client id>');
angular.module('yourApp').constant('WORLDSKILLS_API_AUTH', 'https://api.worldskills.org/auth');
angular.module('yourApp').constant('WORLDSKILLS_AUTHORIZE_URL', 'https://auth.worldskills.org/oauth/authorize');
```

## Return to state

To load the previous state after the user has logged in on WorldSkills Auth, you can use `sessionStorage.getItem('redirect_to_state')`.
Configure the `$urlRouterProvider` as following:

```
angular.module('yourApp').config(function($$urlRouterProvider) {
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
