# Medical Wholesale Marketplace - Implementation Plan

## Technology Stack

### Backend
- **Node.js + Express** - RESTful API
- **PostgreSQL** - Primary database (supports transactions, complex queries)
- **Prisma ORM** - Type-safe database access with migrations
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **Multer** - Image upload handling

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router v6** - Routing
- **TanStack Query** - Server state management
- **Zustand** - Client state (cart, auth)
- **Tailwind CSS** - Styling
- **Shadcn/ui** - Component library (professional, accessible)
- **Recharts** - Analytics visualization

## Architecture

```
medical-wholesale-platform/
├── backend/
│   ├── src/
│   │   ├── config/        # Database, env config
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── orders/
│   │   │   ├── cart/
│   │   │   ├── requirements/
│   │   │   ├── customers/
│   │   │   ├── suppliers/
│   │   │   ├── invoices/
│   │   │   ├── analytics/
│   │   │   └── notifications/
│   │   ├── utils/
│   │   └── app.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # Reusable components
│   │   ├── features/      # Feature modules
│   │   │   ├── wholesaler/
│   │   │   └── customer/
│   │   ├── hooks/         # Custom hooks
│   │   ├── stores/        # Zustand stores
│   │   ├── types/         # TypeScript types
│   │   ├── utils/
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## Database Schema Design

### Core Entities
1. **User** - Authentication & roles
2. **Wholesaler** - Wholesaler profile
3. **Customer** - Medical store profile
4. **CustomerAddress** - Delivery addresses
5. **Category** - Product categories
6. **Product** - Medicine catalog
7. **ProductImage** - Product images
8. **Inventory** - Current stock
9. **InventoryBatch** - Batch tracking
10. **StockTransaction** - Stock movement audit
11. **Cart** - Shopping cart
12. **CartItem** - Cart items
13. **Order** - Customer orders
14. **OrderItem** - Order line items
15. **OrderStatusHistory** - Status tracking
16. **Requirement** - Customer requirements
17. **Supplier** - Supplier management
18. **PurchaseOrder** - Restock orders
19. **PurchaseOrderItem** - Purchase items
20. **Invoice** - Generated invoices
21. **InvoiceItem** - Invoice line items
22. **Payment** - Payment tracking
23. **Notification** - User notifications
24. **DemandPrediction** - Sales forecasting

## Implementation Phases

### Phase 1: Foundation (Priority 1)
- [x] Project structure
- [ ] Database schema with Prisma
- [ ] User authentication & authorization
- [ ] Role-based access control (RBAC)
- [ ] Basic API structure
- [ ] Basic frontend setup with routing

### Phase 2: Wholesaler Core (Priority 2)
- [ ] Product CRUD operations
- [ ] Category management
- [ ] Image upload system
- [ ] Inventory management
- [ ] Batch tracking
- [ ] Stock transaction logging
- [ ] Wholesaler dashboard with metrics

### Phase 3: Customer Marketplace (Priority 3)
- [ ] Customer registration & profile
- [ ] Product catalog display
- [ ] Search & filter system
- [ ] Product detail pages
- [ ] Shopping cart with stock validation
- [ ] Customer dashboard

### Phase 4: Order Management (Priority 4)
- [ ] Checkout flow
- [ ] Order creation with stock reservation
- [ ] Concurrent order protection (database transactions)
- [ ] Order status management
- [ ] Stock deduction on confirmation
- [ ] Order tracking for customers
- [ ] Reorder functionality

### Phase 5: Business Operations (Priority 5)
- [ ] Customer requirement submission
- [ ] Requirement management for wholesaler
- [ ] Supplier management
- [ ] Restock recommendations
- [ ] Purchase order creation
- [ ] Customer management
- [ ] Invoice generation
- [ ] Payment tracking

### Phase 6: Analytics & Intelligence (Priority 6)
- [ ] Sales analytics
- [ ] Inventory analytics
- [ ] Low-stock alerts
- [ ] Expiry monitoring & alerts
- [ ] Demand prediction (statistical model)
- [ ] Reports & exports

### Phase 7: Production Readiness (Priority 7)
- [ ] Comprehensive error handling
- [ ] Input validation & sanitization
- [ ] Security hardening
- [ ] Audit logging
- [ ] Performance optimization
- [ ] Automated tests
- [ ] Deployment configuration

## Key Technical Decisions

### Stock Management Strategy
- Use PostgreSQL transactions for all stock operations
- Implement row-level locking during order creation
- Separate fields: `totalQuantity`, `reservedQuantity`, `availableQuantity`
- Stock validation on both cart add and checkout
- FEFO (First Expiry, First Out) batch allocation

### Security Implementation
- JWT tokens with refresh mechanism
- Role-based middleware for all protected routes
- Server-side validation of prices, quantities, stock
- Rate limiting on authentication endpoints
- Input sanitization using validator.js
- CORS configuration
- SQL injection protection via Prisma parameterized queries

### Inventory Transaction Flow
```
Order Placed → Reserve Stock → Order Confirmed → Deduct Stock → Create Transaction
               ↓
            If Cancelled → Release Reservation
```

### Concurrent Order Protection
```sql
BEGIN TRANSACTION;
  SELECT availableQuantity FROM Inventory WHERE id = ? FOR UPDATE;
  -- Validate quantity
  UPDATE Inventory SET availableQuantity = availableQuantity - ? WHERE id = ?;
  INSERT INTO Order ...;
  INSERT INTO StockTransaction ...;
COMMIT;
```

### Optional Fields Strategy
- Database: All optional fields nullable
- Validation: Skip validation for null/undefined optional fields
- UI: Conditionally render only provided information
- API: Allow product creation without optional fields

## Next Steps
1. Initialize Node.js + Express backend
2. Set up Prisma with PostgreSQL schema
3. Create database migrations
4. Implement authentication system
5. Build wholesaler product management
6. Develop customer marketplace
7. Implement order system with stock management
8. Add business operations features
9. Build analytics & predictions
10. Test and deploy
