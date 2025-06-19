// subscribers/product.subscriber.ts
import { IEventBusService } from '@medusajs/types';
import { AlgoliaService } from '../services/algolia.service';

export class ProductSubscriber {
  constructor(
    private readonly eventBusService: IEventBusService,
    private readonly algoliaService: AlgoliaService
  ) {
    this.eventBusService.subscribe('product.created', this.handleProductCreated);
    this.eventBusService.subscribe('product.updated', this.handleProductUpdated);
    this.eventBusService.subscribe('product.deleted', this.handleProductDeleted);
    this.eventBusService.subscribe('product-variant.created', this.handleVariantCreated);
    this.eventBusService.subscribe('product-variant.updated', this.handleVariantUpdated);
    this.eventBusService.subscribe('product-variant.deleted', this.handleVariantDeleted);
  }

  private handleProductCreated = async (event: { data: unknown }) => {
    try {
      const { id } = event.data as { id: string };
      console.log(`Product created event received: ${id}`);
      // Note: In a real implementation, you'd fetch the full product data
      // const product = await this.productService.retrieve(id, { relations: ['variants', 'categories', 'tags'] });
      // await this.algoliaService.indexProduct(product);
    } catch (error) {
      console.error('Error handling product created event:', error);
    }
  };

  private handleProductUpdated = async (event: { data: unknown }) => {
    try {
      const { id } = event.data as { id: string };
      console.log(`Product updated event received: ${id}`);
      // const product = await this.productService.retrieve(id, { relations: ['variants', 'categories', 'tags'] });
      // await this.algoliaService.updateProduct(product);
    } catch (error) {
      console.error('Error handling product updated event:', error);
    }
  };

  private handleProductDeleted = async (event: { data: unknown }) => {
    try {
      const { id } = event.data as { id: string };
      console.log(`Product deleted event received: ${id}`);
      await this.algoliaService.deleteProduct(id);
    } catch (error) {
      console.error('Error handling product deleted event:', error);
    }
  };

  private handleVariantCreated = async (event: { data: unknown }) => {
    try {
      const { id, product_id } = event.data as { id: string, product_id: string };
      console.log(`Variant created event received: ${id}`);
      // Reindex the entire product when a variant is created
      // const product = await this.productService.retrieve(product_id, { relations: ['variants', 'categories', 'tags'] });
      // await this.algoliaService.updateProduct(product);
    } catch (error) {
      console.error('Error handling variant created event:', error);
    }
  };

  private handleVariantUpdated = async (event: { data: unknown }) => {
    try {
      const { id, product_id } = event.data as { id: string, product_id: string };
      console.log(`Variant updated event received: ${id}`);
      // const product = await this.productService.retrieve(product_id, { relations: ['variants', 'categories', 'tags'] });
      // await this.algoliaService.updateProduct(product);
    } catch (error) {
      console.error('Error handling variant updated event:', error);
    }
  };

  private handleVariantDeleted = async (event: { data: unknown }) => {
    try {
      const { id, product_id } = event.data as { id: string, product_id: string };
      console.log(`Variant deleted event received: ${id}`);
      // const product = await this.productService.retrieve(product_id, { relations: ['variants', 'categories', 'tags'] });
      // await this.algoliaService.updateProduct(product);
    } catch (error) {
      console.error('Error handling variant deleted event:', error);
    }
  };
}
