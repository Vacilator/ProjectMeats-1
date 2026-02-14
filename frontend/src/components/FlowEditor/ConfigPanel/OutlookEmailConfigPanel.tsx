/**
 * Configuration panel for OutlookEmailNode
 */
import React, { useState } from 'react';
import { Mail, Plus, X } from 'lucide-react';
import styled from 'styled-components';

const PanelContainer = styled.div`
  padding: 16px;
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
  color: rgb(var(--color-text-primary));
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 13px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 13px;
  min-height: 100px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 13px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const EmailList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EmailItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RemoveButton = styled.button`
  padding: 4px;
  border: none;
  background: transparent;
  color: rgb(var(--color-error));
  cursor: pointer;
  border-radius: 4px;
  
  &:hover {
    background: rgba(var(--color-error), 0.1);
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  background: white;
  color: rgb(var(--color-text-primary));
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const HelpText = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
  font-style: italic;
`;

interface OutlookEmailConfigPanelProps {
  nodeId: string;
  data: {
    label?: string;
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
    importance?: 'low' | 'normal' | 'high';
  };
  onChange: (data: any) => void;
}

export const OutlookEmailConfigPanel: React.FC<OutlookEmailConfigPanelProps> = ({
  data,
  onChange,
}) => {
  const [showCC, setShowCC] = useState(data.cc && data.cc.length > 0);
  const [showBCC, setShowBCC] = useState(data.bcc && data.bcc.length > 0);

  const handleToChange = (index: number, value: string) => {
    const newTo = [...(data.to || [])];
    newTo[index] = value;
    onChange({ ...data, to: newTo });
  };

  const handleAddTo = () => {
    onChange({ ...data, to: [...(data.to || []), ''] });
  };

  const handleRemoveTo = (index: number) => {
    const newTo = data.to.filter((_, i) => i !== index);
    onChange({ ...data, to: newTo });
  };

  const handleCCChange = (index: number, value: string) => {
    const newCC = [...(data.cc || [])];
    newCC[index] = value;
    onChange({ ...data, cc: newCC });
  };

  const handleAddCC = () => {
    setShowCC(true);
    onChange({ ...data, cc: [...(data.cc || []), ''] });
  };

  const handleRemoveCC = (index: number) => {
    const newCC = (data.cc || []).filter((_, i) => i !== index);
    onChange({ ...data, cc: newCC });
    if (newCC.length === 0) setShowCC(false);
  };

  const handleBCCChange = (index: number, value: string) => {
    const newBCC = [...(data.bcc || [])];
    newBCC[index] = value;
    onChange({ ...data, bcc: newBCC });
  };

  const handleAddBCC = () => {
    setShowBCC(true);
    onChange({ ...data, bcc: [...(data.bcc || []), ''] });
  };

  const handleRemoveBCC = (index: number) => {
    const newBCC = (data.bcc || []).filter((_, i) => i !== index);
    onChange({ ...data, bcc: newBCC });
    if (newBCC.length === 0) setShowBCC(false);
  };

  return (
    <PanelContainer>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Mail size={20} />
        <h3 style={{ margin: 0 }}>Send Email (Outlook)</h3>
      </div>

      <Section>
        <Label>Node Label</Label>
        <Input
          type="text"
          value={data.label || ''}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
          placeholder="Send Email"
        />
      </Section>

      <Section>
        <Label>To Recipients *</Label>
        <EmailList>
          {(data.to || ['']).map((email, index) => (
            <EmailItem key={index}>
              <Input
                type="email"
                value={email}
                onChange={(e) => handleToChange(index, e.target.value)}
                placeholder="recipient@example.com or {{variable}}"
              />
              {data.to.length > 1 && (
                <RemoveButton onClick={() => handleRemoveTo(index)}>
                  <X size={16} />
                </RemoveButton>
              )}
            </EmailItem>
          ))}
        </EmailList>
        <AddButton onClick={handleAddTo} style={{ marginTop: '8px' }}>
          <Plus size={16} />
          Add Recipient
        </AddButton>
        <HelpText>Use {`{{variable}}`} to insert workflow context values</HelpText>
      </Section>

      {showCC && (
        <Section>
          <Label>CC</Label>
          <EmailList>
            {(data.cc || ['']).map((email, index) => (
              <EmailItem key={index}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => handleCCChange(index, e.target.value)}
                  placeholder="cc@example.com or {{variable}}"
                />
                <RemoveButton onClick={() => handleRemoveCC(index)}>
                  <X size={16} />
                </RemoveButton>
              </EmailItem>
            ))}
          </EmailList>
          <AddButton onClick={handleAddCC} style={{ marginTop: '8px' }}>
            <Plus size={16} />
            Add CC
          </AddButton>
        </Section>
      )}

      {!showCC && (
        <AddButton onClick={handleAddCC} style={{ marginBottom: '16px' }}>
          <Plus size={16} />
          Add CC
        </AddButton>
      )}

      {showBCC && (
        <Section>
          <Label>BCC</Label>
          <EmailList>
            {(data.bcc || ['']).map((email, index) => (
              <EmailItem key={index}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => handleBCCChange(index, e.target.value)}
                  placeholder="bcc@example.com or {{variable}}"
                />
                <RemoveButton onClick={() => handleRemoveBCC(index)}>
                  <X size={16} />
                </RemoveButton>
              </EmailItem>
            ))}
          </EmailList>
          <AddButton onClick={handleAddBCC} style={{ marginTop: '8px' }}>
            <Plus size={16} />
            Add BCC
          </AddButton>
        </Section>
      )}

      {!showBCC && (
        <AddButton onClick={handleAddBCC} style={{ marginBottom: '16px' }}>
          <Plus size={16} />
          Add BCC
        </AddButton>
      )}

      <Section>
        <Label>Subject *</Label>
        <Input
          type="text"
          value={data.subject || ''}
          onChange={(e) => onChange({ ...data, subject: e.target.value })}
          placeholder="Email subject"
        />
        <HelpText>Use {`{{variable}}`} to insert workflow context values</HelpText>
      </Section>

      <Section>
        <Label>Message Body *</Label>
        <TextArea
          value={data.body || ''}
          onChange={(e) => onChange({ ...data, body: e.target.value })}
          placeholder="Email message body"
        />
        <HelpText>
          Use {`{{variable}}`} to insert workflow context values.
          Example: {`{{customer.name}}`}, {`{{order.total}}`}
        </HelpText>
      </Section>

      <Section>
        <Label>Importance</Label>
        <Select
          value={data.importance || 'normal'}
          onChange={(e) => onChange({ ...data, importance: e.target.value as 'low' | 'normal' | 'high' })}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </Select>
      </Section>
    </PanelContainer>
  );
};

export default OutlookEmailConfigPanel;
