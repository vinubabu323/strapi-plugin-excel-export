# Excel Export

This plugin allows users to generate and download excel files directly from their strapi application, streamlining data management and analysis. With intuitive configuration options, users can define the data to be included in the excel file.The plugin is designed to be user-friendly, offering a seamless experience for both developers and end-users.

# Getting Started

This plugin allows users to extract data from strapi backend into **.xlsx** format

![multi-select video](./screenshots/working.mp4)

## How to install

1.  Go into your strapi project.
2.  Install the plugin using the command `npm i strapi-plugin-excel-export-2024` or `yarn add strapi-plugin-excel-export-2024`
3.  The plugin will be added to your strapi project.

## How to use

1.  Create an **excel.js** file in the config folder. This file is used to provide tables and columns that need to be in the excel file

```
module.exports = {
  config: {
    "api::contact-form.contact-form": {
      columns: [
        "first_name",
        "last_name",
        "phone_no",
        "business_email",
        "job_title",
        "company_name",
        "company_website",
        "city",
        "message",
      ],
      relation: {
        solution: {
          column: ["title"],
        },
      },
      locale: "false",
    },
  },
};
```

- The tables **uid** (api::contact-form.contact-form) need to be given following by its columns required
  - The columns has to be exactly like in the **schema**.
- Relational fields need to be specified in the relation. For example consider the relation as solution and the column wanted from that relation is title
  - **Note :** Currently one level of relation is supported.
- The locale field is for i18 translation plugin. If there is translation for the table you have to make it true.

  - **Note :** Currently data will be only availabe in 'en'.

- **You can't extract data from dynamic zone or nested components.**
