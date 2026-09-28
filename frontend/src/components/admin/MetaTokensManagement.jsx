import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Button, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TestTube as TestIcon,
  Visibility as ViewIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';

const MetaTokensManagement = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [showTokens, setShowTokens] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    access_token: '',
    description: '',
    is_active: true
  });

  // Fetch tokens
  const fetchTokens = async () => {
    try {
      const response = await fetch('/api/meta-tokens', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTokens(data);
      } else {
        setError('Failed to fetch tokens');
      }
    } catch (err) {
      setError('Error fetching tokens: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const url = editingToken 
        ? `/api/meta-tokens/${editingToken.id}`
        : '/api/meta-tokens';
      
      const method = editingToken ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setSuccess(editingToken ? 'Token updated successfully' : 'Token created successfully');
        setOpenDialog(false);
        resetForm();
        fetchTokens();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to save token');
      }
    } catch (err) {
      setError('Error saving token: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (tokenId, tokenName) => {
    if (!window.confirm(`Are you sure you want to delete token "${tokenName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/meta-tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setSuccess('Token deleted successfully');
        fetchTokens();
      } else {
        setError('Failed to delete token');
      }
    } catch (err) {
      setError('Error deleting token: ' + err.message);
    }
  };

  // Handle test token
  const handleTestToken = async (tokenId, tokenName) => {
    try {
      setSuccess('');
      setError('');
      
      const response = await fetch(`/api/meta-tokens/${tokenId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess(`Token "${tokenName}" is working correctly!`);
      } else {
        setError(`Token "${tokenName}" test failed: ${result.message}`);
      }
      
      // Refresh tokens to update stats
      fetchTokens();
    } catch (err) {
      setError('Error testing token: ' + err.message);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      access_token: '',
      description: '',
      is_active: true
    });
    setEditingToken(null);
  };

  // Open edit dialog
  const openEditDialog = (token) => {
    setFormData({
      name: token.name,
      access_token: token.access_token.includes('...') ? '' : token.access_token,
      description: token.description,
      is_active: token.is_active
    });
    setEditingToken(token);
    setOpenDialog(true);
  };

  // Toggle token visibility
  const toggleTokenVisibility = (tokenId) => {
    setShowTokens(prev => ({
      ...prev,
      [tokenId]: !prev[tokenId]
    }));
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card>
      <CardHeader 
        title="Meta Access Tokens Management"
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Add Token
          </Button>
        }
      />
      <CardContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Access Token</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Stats</TableCell>
                  <TableCell>Last Used</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>{token.name}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {showTokens[token.id] ? token.access_token : token.access_token}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => toggleTokenVisibility(token.id)}
                        >
                          {showTokens[token.id] ? <VisibilityOffIcon /> : <ViewIcon />}
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>{token.description || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={token.is_active ? 'Active' : 'Inactive'}
                        color={token.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        ✓ {token.success_count} / ✗ {token.error_count}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {token.last_used ? formatDate(token.last_used) : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Test Token">
                          <IconButton
                            size="small"
                            onClick={() => handleTestToken(token.id, token.name)}
                            color="primary"
                          >
                            <TestIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Token">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(token)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Token">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(token.id, token.name)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {tokens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No tokens configured. Add your first Meta access token to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <form onSubmit={handleSubmit}>
            <DialogTitle>
              {editingToken ? 'Edit Meta Token' : 'Add New Meta Token'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <TextField
                  label="Token Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  fullWidth
                />
                
                <TextField
                  label="Access Token"
                  value={formData.access_token}
                  onChange={(e) => setFormData(prev => ({ ...prev, access_token: e.target.value }))}
                  required={!editingToken}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder={editingToken ? "Leave empty to keep current token" : "Enter Meta access token"}
                />
                
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  fullWidth
                  multiline
                  rows={2}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                  }
                  label="Active"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setOpenDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={loading}>
                {editingToken ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default MetaTokensManagement;
