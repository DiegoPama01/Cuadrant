from django.contrib.postgres.fields import DateTimeRangeField
from django.db.models import Func


class DateTimeRange(Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()
