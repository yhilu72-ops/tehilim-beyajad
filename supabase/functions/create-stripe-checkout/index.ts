import {createCheckoutHandler} from '../_shared/stripe-handlers.ts';
import {runtime} from '../_shared/stripe-runtime.ts';
Deno.serve(createCheckoutHandler(runtime()));
