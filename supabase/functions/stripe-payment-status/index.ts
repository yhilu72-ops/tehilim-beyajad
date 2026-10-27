import {createStatusHandler} from '../_shared/stripe-handlers.ts';
import {runtime} from '../_shared/stripe-runtime.ts';
Deno.serve(createStatusHandler(runtime()));
