import type { CustomerType } from '../types';

/** The full checklist shown in the side panel once a customer type is chosen. */
export const NEEDS: Record<CustomerType, string[]> = {
  individual: [
    "A valid means of ID (NIN slip, international passport, driver's license or voter's card)",
    'Your BVN and NIN',
    'Proof of address from the last 3 months, such as a utility bill or bank statement',
    'A passport photograph',
    'Your signature mandate card',
  ],
  corporate: [
    'CAC certificate of incorporation',
    'CAC forms CAC2.3 and CAC1.1 for directors and shareholders',
    'Memorandum and articles of association',
    'A board resolution to open the account and obtain the facility',
    'The last 12 months of company bank statements',
    'ID, BVN, NIN and proof of address for each director, signatory and owner above 5%',
  ],
};

/** The three-line version shown on the customer-type cards. */
export const NEEDS_SHORT: Record<CustomerType, string[]> = {
  individual: ['A valid ID', 'Your BVN and NIN', 'Proof of address'],
  corporate: ['CAC certificate and forms', 'Directors and owners above 5%', 'Bank statements'],
};

export const CUSTOMER_LABEL: Record<CustomerType, string> = {
  individual: 'Individual customer',
  corporate: 'Corporate customer',
};

export const CONTACT = {
  email: 'office@woodhallfinanceltd.com',
  phoneDisplay: '+234 14549820',
  phoneHref: 'tel:+23414549820',
  address: 'No 1 Bitou Street, Wuse 2, Abuja FCT',
  website: 'woodhallfinanceltd.com',
  websiteHref: 'https://woodhallfinanceltd.com',
};
