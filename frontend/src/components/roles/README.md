# Role Management Component

This component provides a complete role management interface with the ability to:
- View all roles in a table format
- Create new roles with permissions
- Edit existing roles
- Delete roles
- Set reporting hierarchy with the "Report To" field

## Features

- **Report To Functionality**: Allows setting up a management hierarchy by specifying which role a particular role reports to
- **Permission Management**: Assign specific permissions to each role
- **Responsive Design**: Works well on desktop and mobile devices
- **Real-time Validation**: Form validation to ensure data integrity
- **Error Handling**: Comprehensive error handling and user feedback

## Integration

### Backend Integration

Make sure the backend API endpoints support the `report_to` field:

1. The role schema should include `report_to` field
2. Create and update endpoints should accept this field
3. Role response should include this field

### Frontend Integration

To use this component in your frontend:

```jsx
import { RolesManager } from './components/roles';

// Then use it in your routes
<Route path="/roles" element={<RolesManager />} />
```

## API Requirements

The component expects the following API endpoints:

- `GET /api/roles/` - Get all roles
- `POST /api/roles/` - Create a new role
- `PUT /api/roles/{id}` - Update a role
- `DELETE /api/roles/{id}` - Delete a role

Each role object should have the following structure:

```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "report_to": "string", 
  "permissions": ["string"],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

The `report_to` field should contain the name of the role that this role reports to.

## Configuration

You can customize the API URL by modifying the `API_URL` constant at the top of the component file.
