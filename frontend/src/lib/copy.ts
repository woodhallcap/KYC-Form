import type { CustomerType } from '../types';

/** The full checklist shown in the side panel once a customer type is chosen. */
export const NEEDS: Record<CustomerType, string[]> = {
  individual: [
    "A valid means of ID (NIN slip, international passport, driver's license or voter's card)",
    'Your BVN and NIN',
    'Proof of address from the last 3 months: a utility bill and a bank statement',
    'The last 12 months of bank statements',
    'A recent passport photograph',
    'A photo or scan of your handwritten signature',
    'Your work ID, employment letter and signature mandate card',
  ],
  corporate: [
    'CAC certificate of incorporation and CAC status report',
    'CAC forms CAC2.3 and CAC1.1 for directors and shareholders',
    'Memorandum and articles of association',
    'A board resolution to open the account and obtain the facility',
    'The last 12 months of company bank statements',
    'Government-issued ID and a recent passport photograph of each authorized signatory',
    'Corporate ID of the authorized signatories',
    "Photos or scans of both signatories' handwritten signatures and the company seal or stamp",
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
  email: 'info@woodhallfinanceltd.com',
  phoneDisplay: '+234 14549820',
  phoneHref: 'tel:+23414549820',
  address: '8A Modupe Alakija Cres, Ikoyi, Lagos 106104, Lagos',
  website: 'woodhallfinanceltd.com',
  websiteHref: 'https://woodhallfinanceltd.com',
};
