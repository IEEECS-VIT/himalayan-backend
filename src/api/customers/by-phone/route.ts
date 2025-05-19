import { container } from "@medusajs/framework";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";

type Input = {
  phone: string;
  first_name: string;
  last_name: string;
  email: string;
};

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone, first_name, last_name, email } = req.body as Input;
  const authModuleService = container.resolve(Modules.AUTH);
  const authIdentity = await authModuleService.createAuthIdentities({
    provider_identities: [
      {
        provider: "phone",
        entity_id: phone,
      },
    ],
  });
  if (!phone) {
    return res.status(400).send({ error: "Phone number is required" });
  }
  const customerModuleService = container.resolve(Modules.CUSTOMER);
  const [customers] = await customerModuleService.listAndCountCustomers();
  console.log("customers", customers);
  const customer = customers.find((customer) => {
    return customer.metadata?.phone === phone;
  });
  if (customer) {
    console.log("customer", customer);
    return res.status(400).send({ error: "Customer already exists" });
  }
  try {
    const { result } = await createCustomerAccountWorkflow(req.scope).run({
      input: {
        authIdentityId: authIdentity.id,
        customerData: {
          first_name,
          last_name,
          email,
          metadata: {
            phone,
          },
        },
      },
    });

    res.send(result);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).send({ error: "Failed to create customer" });
  }
}
