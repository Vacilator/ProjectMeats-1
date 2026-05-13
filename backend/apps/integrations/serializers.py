from rest_framework import serializers


class EmailActionSerializer(serializers.Serializer):
    label = serializers.CharField()
    url = serializers.CharField()


class EmailFailureSerializer(serializers.Serializer):
    state = serializers.CharField()
    category = serializers.CharField()
    code = serializers.CharField()
    legacy_error_code = serializers.CharField(required=False, allow_blank=True)
    retryable = serializers.BooleanField()
    message = serializers.CharField()
    hint = serializers.CharField(required=False, allow_blank=True)
    provider = serializers.CharField(required=False, allow_blank=True)
    stage = serializers.CharField(required=False, allow_blank=True)
    detail_type = serializers.CharField(required=False, allow_blank=True)
    details = serializers.JSONField(required=False)


class EmailSyncStatsSerializer(serializers.Serializer):
    tenants_processed = serializers.IntegerField(required=False)
    emails_scanned = serializers.IntegerField(required=False)
    emails_matched = serializers.IntegerField(required=False)
    emails_fetched = serializers.IntegerField(required=False)
    emails_saved = serializers.IntegerField(required=False)
    emails_skipped = serializers.IntegerField(required=False)
    errors = serializers.IntegerField(required=False)
    errors_detail = serializers.ListField(child=serializers.CharField(), required=False)
    last_cutoff = serializers.CharField(required=False, allow_null=True)
    error_code = serializers.CharField(required=False, allow_blank=True)
    failure = EmailFailureSerializer(required=False)
    total_emails_fetched = serializers.IntegerField(required=False)
    total_emails_saved = serializers.IntegerField(required=False)
    total_errors = serializers.IntegerField(required=False)
    tenant_id = serializers.CharField(required=False)
    provider_id = serializers.IntegerField(required=False)
    error = serializers.CharField(required=False, allow_blank=True)


class EmailSyncResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    message = serializers.CharField()
    error = serializers.CharField(required=False, allow_blank=True)
    code = serializers.CharField()
    error_code = serializers.CharField(required=False, allow_blank=True)
    tenant_id = serializers.CharField()
    provider_email = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    hint = serializers.CharField(required=False, allow_blank=True)
    cta = EmailActionSerializer(required=False)
    failure = EmailFailureSerializer(required=False)
    stats = EmailSyncStatsSerializer(required=False)
    details = serializers.JSONField(required=False)


class EmailAutoSyncQueuedResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    accepted = serializers.BooleanField()
    message = serializers.CharField()
    code = serializers.CharField(required=False, allow_blank=True)
    tenant_id = serializers.CharField()
    source = serializers.CharField()
    provider_email = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    task_id = serializers.CharField(required=False, allow_blank=True)
    failure = EmailFailureSerializer(required=False)
    details = serializers.JSONField(required=False)


class EmailAutoSyncTaskResultSerializer(serializers.Serializer):
    success = serializers.BooleanField(required=False)
    tenant_id = serializers.CharField(required=False)
    stats = EmailSyncStatsSerializer(required=False)
    ai_inbox = serializers.JSONField(required=False)


class EmailAutoSyncStatusResponseSerializer(serializers.Serializer):
    task_id = serializers.CharField()
    state = serializers.CharField()
    ready = serializers.BooleanField()
    successful = serializers.BooleanField()
    failed = serializers.BooleanField()
    result = EmailAutoSyncTaskResultSerializer(required=False)


class EmailReviewDraftSummarySerializer(serializers.Serializer):
    id = serializers.CharField()
    draft_type = serializers.CharField()
    status = serializers.CharField()
    summary = serializers.CharField()
    classification_confidence = serializers.FloatField(required=False, allow_null=True)


class EmailLogItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    message_id = serializers.CharField()
    subject = serializers.CharField()
    sender = serializers.CharField()
    status = serializers.CharField()
    provider_type = serializers.CharField(required=False, allow_null=True)
    has_attachments = serializers.BooleanField()
    attachment_count = serializers.IntegerField(required=False)
    attachment_filenames = serializers.ListField(child=serializers.CharField(), required=False)
    extracted_data = serializers.JSONField(required=False, allow_null=True)
    related_order_id = serializers.IntegerField(required=False, allow_null=True)
    draft = EmailReviewDraftSummarySerializer(required=False, allow_null=True)
    error_message = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    failure = EmailFailureSerializer(required=False, allow_null=True)
    created_at = serializers.CharField()
    processed_at = serializers.CharField(required=False, allow_null=True)


class EmailLogListResponseSerializer(serializers.Serializer):
    emails = EmailLogItemSerializer(many=True)
    count = serializers.IntegerField()
