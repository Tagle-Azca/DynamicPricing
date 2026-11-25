import { h } from './dom.js';
import { field, showErrors } from './field.js';
import { REGIONS } from './regions.js';
import { validateContact } from './validate.js';

// Step 1: contact and address. Region goes to the cart as soon as it is chosen.
export function createContactStep({ cart, onDone }) {
  const f = {
    email: field({
      id: 'ct-email',
      label: 'Email',
      type: 'email',
      autocomplete: 'email',
      wrap: 'span-2',
    }),
    fullName: field({ id: 'ct-name', label: 'Full name', autocomplete: 'name', wrap: 'span-2' }),
    street: field({
      id: 'ct-street',
      label: 'Street address',
      autocomplete: 'street-address',
      wrap: 'span-2',
    }),
    city: field({ id: 'ct-city', label: 'City', autocomplete: 'address-level2' }),
    postalCode: field({ id: 'ct-postal', label: 'Postal code', autocomplete: 'postal-code' }),
    region: field({
      id: 'ct-region',
      label: 'Region',
      type: 'select',
      options: REGIONS,
      autocomplete: 'country',
      wrap: 'span-2',
    }),
  };
  f.region.control.addEventListener('change', () => cart.setRegion(f.region.value()));

  const values = () => ({
    email: f.email.value().trim(),
    fullName: f.fullName.value().trim(),
    street: f.street.value().trim(),
    city: f.city.value().trim(),
    postalCode: f.postalCode.value().trim(),
    region: f.region.value(),
  });

  const form = h(
    'form',
    {
      class: 'step-body form-cols',
      novalidate: true,
      onSubmit: (e) => {
        e.preventDefault();
        if (!showErrors(f, validateContact(values()))) return;
        cart.setRegion(f.region.value());
        onDone();
      },
    },
    Object.values(f).map((x) => x.node),
    h('button', { type: 'submit', class: 'pill primary big span-2', text: 'Continue to delivery' }),
  );

  return {
    node: form,
    values,
    focus: () => f.email.control.focus(),
    summary: () => {
      const v = values();
      return `${v.fullName}, ${v.street}, ${v.city} ${v.postalCode}, ${v.region}`;
    },
    prefill(email) {
      if (!f.email.value()) f.email.setValue(email);
    },
    reset() {
      form.reset();
      for (const x of Object.values(f)) x.setError('');
    },
  };
}
