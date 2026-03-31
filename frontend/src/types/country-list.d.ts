declare module 'country-list' {
  export interface CountryListItem {
    code: string;
    name: string;
  }

  export function getData(): CountryListItem[];
}
