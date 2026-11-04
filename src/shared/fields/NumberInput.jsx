import { NumberStepper } from '../../components/ui/index.js';

/**
 * The app's number box: − / + buttons beside the value, and a name for every part so screen readers can announce
 * them (PrimeReact leaves the spinner buttons unnamed). `label` says what the number is.
 */
export default function NumberInput(props) {
  return <NumberStepper {...props} />;
}
